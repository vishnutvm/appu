import json
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import appu
from conversation import INTERRUPTED_MARKER, Conversation
from voice import DETAILS_ON_SCREEN, SpokenPartFilter, StreamingVoiceSession, VoiceEngine


class FakeOllamaStream:
    """Streams the given content deltas (and optional tool calls) like Ollama does."""

    def __init__(self, deltas, tool_calls=None, delay=0.0):
        self._lines = [json.dumps({"message": {"content": d}}).encode() + b"\n" for d in deltas]
        if tool_calls:
            self._lines.append(json.dumps({"message": {"content": "", "tool_calls": tool_calls}}).encode() + b"\n")
        self._lines.append(json.dumps({"done": True}).encode() + b"\n")
        self._delay = delay

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def __iter__(self):
        for line in self._lines:
            if self._delay:
                time.sleep(self._delay)
            yield line


class FakeKokoro:
    def __init__(self):
        self.spoken = []

    def synthesize_wav(self, text, voice=None):
        self.spoken.append(text)
        return b"RIFF" + text.encode()


def feed_all(target, text, step=3):
    out = ""
    for i in range(0, len(text), step):
        out += target.feed(text[i:i + step])
    return out + target.flush()


class ConversationTests(unittest.TestCase):
    def test_keeps_last_n_turns(self):
        conv = Conversation(max_turns=2)
        for i in range(4):
            conv.add_turn(f"q{i}", f"a{i}")
        msgs = conv.messages()
        self.assertEqual([m["content"] for m in msgs], ["q2", "a2", "q3", "a3"])

    def test_trims_by_size(self):
        conv = Conversation(max_turns=10, max_chars=50)
        conv.add_turn("x" * 35, "y" * 10)
        conv.add_turn("short", "reply")
        self.assertEqual(conv.turn_count(), 1)

    def test_interrupted_turn_is_marked(self):
        conv = Conversation()
        conv.add_turn("tell me a story", "Once upon", interrupted=True)
        self.assertTrue(conv.messages()[-1]["content"].endswith(INTERRUPTED_MARKER))
        conv.mark_last_interrupted()
        self.assertEqual(conv.messages()[-1]["content"].count(INTERRUPTED_MARKER), 1)


class SpokenPartFilterTests(unittest.TestCase):
    def test_plain_reply_is_spoken_in_full(self):
        f = SpokenPartFilter()
        self.assertEqual(feed_all(f, "You have two reminders today."), "You have two reminders today.")
        self.assertFalse(f.truncated)

    def test_details_after_blank_line_are_not_spoken(self):
        f = SpokenPartFilter()
        spoken = feed_all(f, "Found 2 things.\n\n- first\n- second")
        self.assertEqual(spoken.strip(), "Found 2 things.")
        self.assertTrue(f.truncated)

    def test_list_directly_after_sentence_is_not_spoken(self):
        f = SpokenPartFilter()
        spoken = feed_all(f, "Here they are:\n1. Call Arun\n2. Pay rent")
        self.assertEqual(spoken.strip(), "Here they are:")

    def test_code_block_is_not_spoken(self):
        f = SpokenPartFilter()
        spoken = feed_all(f, "Use this.\n```python\nprint(1)\n```")
        self.assertNotIn("print", spoken)


class StreamingVoiceSessionTests(unittest.TestCase):
    def make_session(self):
        engine = VoiceEngine(voice_name="am_adam")
        engine.kokoro = FakeKokoro()
        chunks = []
        session = engine.start_streaming_session(on_audio=lambda wav, text: chunks.append(text))
        return engine, session, chunks

    def test_audio_delivered_in_order_with_details_notice(self):
        engine, session, chunks = self.make_session()
        for token in ["Sure thing. ", "Your standup is at ", "four thirty today.", "\n\n", "- details"]:
            session.feed_token(token)
        session.finish_text()
        session.wait(timeout=5)
        self.assertEqual(chunks[0], "Sure thing.")
        self.assertIn("four thirty today.", " ".join(chunks))
        self.assertEqual(chunks[-1], DETAILS_ON_SCREEN)
        self.assertNotIn("details", " ".join(chunks[:-1]))

    def test_spoken_intro_before_list_is_spoken_without_waiting_for_the_end(self):
        engine, session, chunks = self.make_session()
        for token in ["Here are three quick tips", ":", "\n\n", "1. Time blocking"]:
            session.feed_token(token)
        deadline = time.time() + 5
        while len(chunks) < 2 and time.time() < deadline:
            time.sleep(0.01)
        # Spoken before finish_text() is called.
        self.assertEqual(chunks, ["Here are three quick tips:", DETAILS_ON_SCREEN])
        session.finish_text()
        session.wait(timeout=5)
        self.assertEqual(chunks.count(DETAILS_ON_SCREEN), 1)

    def test_first_phrase_breaks_early_at_a_comma(self):
        from voice import StreamingPhraseBuffer
        buf = StreamingPhraseBuffer()
        self.assertEqual(buf.add_token("Once upon a time, in a quiet harbour town"), ["Once upon a time,"])
        self.assertEqual(buf.add_token(", there lived"), [])

    def test_cancel_stops_delivery(self):
        engine, session, chunks = self.make_session()
        session.cancel()
        session.feed_token("This should never be spoken. Not at all.")
        session.finish_text()
        session.wait(timeout=5)
        self.assertEqual(chunks, [])

    def test_engine_stop_cancels_session(self):
        engine, session, chunks = self.make_session()
        engine.stop()
        self.assertTrue(session.interrupt_event.is_set())


class AskModelHistoryAndCancelTests(unittest.TestCase):
    def test_history_is_sent_to_model(self):
        captured = {}

        def fake_urlopen(request, timeout=None):
            captured["payload"] = json.loads(request.data)
            return FakeOllamaStream(["Done."])

        history = [
            {"role": "user", "content": "list my reminders"},
            {"role": "assistant", "content": "1. Call Arun 2. Pay rent"},
        ]
        with patch("appu.urlopen", side_effect=fake_urlopen):
            appu.ask_local_model("cancel the second one", history=history)

        self.assertIn("Current local date and time:", captured["payload"]["messages"][0]["content"])
        roles = [m["role"] for m in captured["payload"]["messages"]]
        self.assertEqual(roles, ["system", "user", "assistant", "user"])
        self.assertEqual(captured["payload"]["messages"][-1]["content"], "cancel the second one")

    def test_cancel_event_raises_with_partial_text(self):
        cancel = threading.Event()

        def on_token(delta):
            if delta == "Once ":
                cancel.set()

        with patch("appu.urlopen", return_value=FakeOllamaStream(["Once ", "upon ", "a time."])):
            with self.assertRaises(appu.TurnInterrupted) as ctx:
                appu.ask_local_model("story", on_token=on_token, cancel_event=cancel)
        self.assertEqual(ctx.exception.partial, "Once ")


class StreamingChatEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), appu.AppuHTTPRequestHandler)
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        appu.CONVERSATION.clear()
        self.fake_kokoro = FakeKokoro()
        self.kokoro_patch = patch.object(appu.VOICE, "kokoro", self.fake_kokoro)
        self.kokoro_patch.start()
        appu.VOICE.set_enabled(True)

    def tearDown(self):
        self.kokoro_patch.stop()

    def post_chat(self, message, **extra):
        body = json.dumps({"message": message, **extra}).encode()
        req = Request(f"http://127.0.0.1:{self.port}/api/chat", data=body,
                      headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(req, timeout=10) as resp:
            return [json.loads(line) for line in resp.read().splitlines() if line.strip()]

    def test_streams_text_audio_and_done(self):
        with patch("appu.urlopen", return_value=FakeOllamaStream(["Hello Vishnu. ", "All good here."])), \
                patch("builtins.print"):
            events = self.post_chat("hi")

        types = [e["type"] for e in events]
        self.assertEqual(types[0], "state")
        self.assertIn("text_delta", types)
        self.assertIn("audio_chunk", types)
        self.assertEqual(types[-1], "done")
        self.assertLess(types.index("text_delta"), types.index("done"))
        text = "".join(e["text"] for e in events if e["type"] == "text_delta")
        self.assertEqual(text, "Hello Vishnu. All good here.")
        self.assertEqual(appu.CONVERSATION.turn_count(), 1)

    def test_tool_round_resets_text_and_acknowledges(self):
        tool_calls = [{"function": {"name": "list_reminders", "arguments": {"status": "pending"}}}]
        responses = [
            FakeOllamaStream(["Let me check."], tool_calls=tool_calls),
            FakeOllamaStream(["You have no reminders."]),
        ]
        with patch("appu.urlopen", side_effect=responses), \
                patch("appu.run_tool", return_value=appu.ToolResult(True, "No reminders found.")), \
                patch("builtins.print"):
            events = self.post_chat("what are my reminders")

        types = [e["type"] for e in events]
        self.assertIn("text_reset", types)
        tool = next(e for e in events if e["type"] == "tool_event")
        self.assertEqual(tool, {"type": "tool_event", "name": "list_reminders", "ok": True})
        self.assertIn("Checking your reminders.", self.fake_kokoro.spoken)
        done = events[-1]
        self.assertTrue(done["executed_tool"])
        self.assertEqual(done["activity"], "success")

    def test_confirm_tool_asks_then_spoken_yes_runs_it_without_the_model(self):
        import memories
        memory = memories.remember("Vishnu drinks filter coffee")
        tool_calls = [{"function": {"name": "forget", "arguments": {"memory_id": memory["id"]}}}]
        responses = [
            FakeOllamaStream([""], tool_calls=tool_calls),
            FakeOllamaStream(['Forget that "Vishnu drinks filter coffee"?']),
        ]
        with patch("appu.urlopen", side_effect=responses), patch("builtins.print"):
            events = self.post_chat("forget that I drink filter coffee")
        approval = next(e for e in events if e["type"] == "approval_required")
        self.assertEqual(approval["tool"], "forget")
        self.assertEqual(events[-1]["activity"], "approval_required")
        self.assertIsNotNone(memories.get(memory["id"]))

        with patch("appu.urlopen") as no_llm, patch("builtins.print"):
            events = self.post_chat("yes")
        no_llm.assert_not_called()
        self.assertIsNone(memories.get(memory["id"]))
        self.assertIn("Forgot", events[-1]["answer"])
        self.assertEqual(events[-1]["activity"], "success")

    def test_stop_interrupts_running_turn(self):
        slow = FakeOllamaStream([f"word{i} " for i in range(50)], delay=0.05)
        results = {}

        def run():
            with patch("appu.urlopen", return_value=slow):
                results["events"] = self.post_chat("long answer please", speak=False)

        with patch("builtins.print"):
            t = threading.Thread(target=run)
            t.start()
            time.sleep(0.3)
            stop = Request(f"http://127.0.0.1:{self.port}/api/chat/stop", data=b"{}",
                           headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(stop, timeout=5) as resp:
                self.assertTrue(json.loads(resp.read())["stopped"])
            t.join(timeout=10)

        done = results["events"][-1]
        self.assertEqual(done["type"], "done")
        self.assertTrue(done["interrupted"])
        self.assertTrue(appu.CONVERSATION.messages()[-1]["content"].endswith(INTERRUPTED_MARKER))

    def test_voice_select_rejects_unknown_voice(self):
        req = Request(f"http://127.0.0.1:{self.port}/api/voice/select",
                      data=json.dumps({"voice": "../../etc"}).encode(),
                      headers={"Content-Type": "application/json"}, method="POST")
        with self.assertRaises(HTTPError) as ctx:
            urlopen(req, timeout=5)
        ctx.exception.close()
        self.assertEqual(ctx.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
