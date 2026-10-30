from datetime import datetime, timedelta
from pathlib import Path
import sqlite3
import tempfile
import time
import unittest
from unittest.mock import patch

import appu
import approvals
import briefing
import conversation as conversation_store
from conversation import Conversation
import db
import memories
import reminders
import tasks
import tools

WEDNESDAY = datetime(2026, 10, 28, 10, 0)


class TempDBTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp.name) / "appu.db"
        patcher = patch.dict("os.environ", {"APPU_DB_PATH": str(self.db_path)})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)


class DueDateTests(unittest.TestCase):
    def date(self, text):
        return reminders.parse_due_date(text, now=WEDNESDAY)[1]

    def test_relative_days(self):
        self.assertEqual(self.date("today"), "2026-10-28 23:59")
        self.assertEqual(self.date("tomorrow"), "2026-10-29 23:59")
        self.assertEqual(self.date("in 3 days"), "2026-10-31 23:59")
        self.assertEqual(self.date("in 2 weeks"), "2026-11-11 23:59")

    def test_weekdays(self):
        self.assertEqual(self.date("friday"), "2026-10-30 23:59")
        self.assertEqual(self.date("next friday"), "2026-11-06 23:59")
        self.assertEqual(self.date("by monday"), "2026-11-02 23:59")
        self.assertEqual(self.date("wednesday"), "2026-10-28 23:59")
        self.assertEqual(self.date("next week"), "2026-11-02 23:59")

    def test_with_time(self):
        self.assertEqual(self.date("friday at 5pm"), "2026-10-30 17:00")
        self.assertEqual(self.date("tomorrow 9:30 am"), "2026-10-29 09:30")
        self.assertEqual(self.date("2026-11-06 18:00"), "2026-11-06 18:00")

    def test_iso_date(self):
        self.assertEqual(self.date("2026-11-06"), "2026-11-06 23:59")

    def test_leading_preposition_on_reminder_time(self):
        for prefixed, plain in [("at 6pm", "6pm"), ("on friday at 5pm", "friday at 5pm"), ("by 9:30 am", "9:30 am")]:
            self.assertEqual(reminders.parse_due_time(prefixed)[1], reminders.parse_due_time(plain)[1])


class MemoryTests(TempDBTest):
    def test_crud(self):
        m = memories.remember("Vishnu prefers short answers", kind="preference")
        self.assertEqual(memories.get(m["id"])["kind"], "preference")
        # Saving the same fact twice keeps one copy.
        self.assertEqual(memories.remember("vishnu prefers short answers")["id"], m["id"])
        self.assertEqual(memories.remember("Vishnu prefers  short answers.")["id"], m["id"])
        self.assertEqual(len(memories.list_all()), 1)
        self.assertTrue(memories.forget(m["id"]))
        self.assertIsNone(memories.get(m["id"]))
        self.assertFalse(memories.forget(m["id"]))

    def test_empty_and_oversized_rejected(self):
        with self.assertRaises(ValueError):
            memories.remember("   ")
        with self.assertRaises(ValueError):
            memories.remember("x" * (memories.MAX_CONTENT + 1))

    def test_recall_ranks_relevant_memory_first(self):
        memories.remember("Vishnu is on leave on Friday 6 November 2026")
        memories.remember("Vishnu's manager is Arun")
        memories.remember("The GPS repo uses Go")
        found = memories.recall("am I free on Friday?")
        self.assertTrue(found)
        self.assertIn("leave", found[0]["content"])
        self.assertEqual(memories.get(found[0]["id"])["use_count"], 1)

    def test_recall_ignores_stopwords_and_punctuation(self):
        memories.remember("Favourite editor is VS Code")
        self.assertEqual(memories.recall("what is it?"), [])
        self.assertEqual(memories.recall('"); DROP TABLE memories; --'), [])
        self.assertEqual(len(memories.list_all()), 1)

    def test_forgotten_memory_leaves_search_index(self):
        m = memories.remember("Birthday is in March")
        memories.forget(m["id"])
        self.assertEqual(memories.recall("birthday"), [])

    def test_prompt_block_has_relevant_and_profile(self):
        self.assertEqual(memories.prompt_block("hello"), "")
        memories.remember("Vishnu is on leave on Friday 6 November 2026")
        block = memories.prompt_block("am I free friday")
        self.assertIn("What you know about the user", block)
        self.assertIn("on leave", block)


class TaskTests(TempDBTest):
    def test_filters(self):
        now = WEDNESDAY
        with patch("reminders.datetime") as fake_dt:
            fake_dt.now.return_value = now
            fake_dt.strptime = datetime.strptime
            fake_dt.fromtimestamp = datetime.fromtimestamp
            due_today = tasks.add_task("Review PR", due="today")
            overdue = tasks.add_task("File expenses", due="2026-10-26")
            later = tasks.add_task("Plan sprint", due="next friday")
        undated = tasks.add_task("Read the Kokoro paper")

        ids = lambda flt: [t["id"] for t in tasks.list_tasks(flt, now=now)]
        self.assertEqual(ids("today"), [overdue["id"], due_today["id"]])
        self.assertEqual(ids("overdue"), [overdue["id"]])
        self.assertEqual(ids("upcoming"), [later["id"]])
        self.assertEqual(set(ids("open")), {due_today["id"], overdue["id"], later["id"], undated["id"]})

        self.assertEqual(due_today["due"], "Wed 28 Oct")
        self.assertEqual(tasks.add_task("Call", due="2026-10-29 18:00")["due"], "Thu 29 Oct 18:00")

        tasks.update_task(due_today["id"], status="done")
        self.assertEqual(ids("done"), [due_today["id"]])
        self.assertNotIn(due_today["id"], ids("today"))

    def test_update_and_validation(self):
        t = tasks.add_task("  Write   docs ", priority=1, project="appu")
        self.assertEqual(t["title"], "Write docs")
        self.assertIn("high priority", tasks.format_task(t))
        self.assertEqual(tasks.list_tasks("open", project="APPU")[0]["id"], t["id"])
        self.assertIsNone(tasks.update_task(999, status="done"))
        with self.assertRaises(ValueError):
            tasks.update_task(t["id"], status="finished")
        with self.assertRaises(ValueError):
            tasks.add_task("")
        cleared = tasks.update_task(t["id"], due="none")
        self.assertIsNone(cleared["due_at"])

    def test_search(self):
        tasks.add_task("Fix the GPS ticket")
        tasks.add_task("Buy milk")
        self.assertEqual([t["title"] for t in tasks.search("gps")], ["Fix the GPS ticket"])


class MigrationTests(unittest.TestCase):
    def test_legacy_reminders_are_copied_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            legacy = Path(tmp) / "reminders.db"
            conn = sqlite3.connect(legacy)
            conn.execute(
                "CREATE TABLE reminders (id INTEGER PRIMARY KEY, title TEXT, due_timestamp REAL, "
                "due_time_str TEXT, status TEXT, notified INTEGER, created_at REAL)"
            )
            conn.execute("INSERT INTO reminders VALUES (7, 'Old one', 1.0, '2026-01-01 10:00', 'pending', 0, 1.0)")
            conn.commit()
            conn.close()

            target = Path(tmp) / "appu.db"
            db.connect(target).close()
            self.assertEqual(db.migrate_legacy_reminders(target, legacy=legacy), 1)
            self.assertFalse(legacy.exists())
            self.assertTrue((Path(tmp) / "reminders.db.migrated").exists())
            items = reminders.list_reminders(status=None, db_path=target)
            self.assertEqual([(r["id"], r["title"]) for r in items], [(7, "Old one")])


class BriefingTests(TempDBTest):
    def test_briefing_content_and_due_flag(self):
        now = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
        self.assertTrue(briefing.briefing_due(now))
        tasks.add_task("Ship Phase 2", due="today", priority=1)
        old = tasks.add_task("Old chore")
        conn = db.connect()
        conn.execute("UPDATE tasks SET due_at = ? WHERE id = ?", ((now - timedelta(days=2)).timestamp(), old["id"]))
        conn.commit()
        conn.close()
        reminders.create_reminder("Stand-up", "in 2 hours")

        data = briefing.daily_briefing(now)
        self.assertEqual([t["title"] for t in data["today"]], ["Ship Phase 2"])
        self.assertEqual([t["title"] for t in data["overdue"]], ["Old chore"])
        self.assertIn("Old chore", data["suggestion"])
        self.assertIn("OVERDUE", data["text"])
        self.assertTrue("Stand-up" in data["text"])
        self.assertFalse(briefing.briefing_due(now))
        self.assertTrue(briefing.briefing_due(now + timedelta(days=1)))

    def test_stale_task_suggestion(self):
        t = tasks.add_task("Refactor turn detector", priority=1)
        conn = db.connect()
        conn.execute("UPDATE tasks SET updated_at = ? WHERE id = ?", (time.time() - 5 * 86400, t["id"]))
        conn.commit()
        conn.close()
        self.assertIn("haven't touched", briefing.suggest_next())

    def test_empty_day(self):
        self.assertIsNone(briefing.suggest_next())
        self.assertIn("No upcoming reminders", briefing.daily_briefing()["text"])


class RegistryTests(TempDBTest):
    def test_routing_selects_relevant_groups(self):
        names = lambda msg, recent=(): {t.name for t in tools.select_tools(msg, recent)}
        self.assertEqual(names("hi, how are you?"), set())
        self.assertIn("create_reminder", names("remind me to call mum at 5"))
        self.assertIn("add_task", names("I need to finish the report by friday"))
        self.assertIn("remember", names("remember that I'm on leave next friday"))
        self.assertIn("daily_briefing", names("good morning"))
        self.assertIn("open_project", names("open the jarvis project in vs code"))
        # A follow-up keeps the groups used in the previous turn.
        self.assertIn("update_task", names("make it high priority", ["tasks"]))

    def test_every_tool_schema_is_valid(self):
        for tool in tools.REGISTRY.values():
            schema = tool.schema()["function"]
            self.assertEqual(schema["name"], tool.name)
            for required in schema["parameters"]["required"]:
                self.assertIn(required, schema["parameters"]["properties"])

    def test_argument_validation(self):
        self.assertTrue(tools.run_tool("update_task", {"task_id": "#3", "status": "done"}).text.startswith("Task #3"))
        self.assertTrue(tools.run_tool("update_task", {"task_id": True}).text.startswith("Error:"))
        self.assertTrue(tools.run_tool("list_tasks", {"filter": "someday"}).text.startswith("Error:"))
        result = tools.run_tool("add_task", {"title": "Ship it", "evil": "x"})
        self.assertTrue(result.ok, result.text)

    def test_handler_value_error_becomes_error_result(self):
        result = tools.run_tool("create_reminder", {"title": "x", "due_time": "whenever"})
        self.assertFalse(result.ok)
        self.assertTrue(result.text.startswith("Error"))


class ApprovalTests(TempDBTest):
    def setUp(self):
        super().setUp()
        tools.APPROVALS.clear()
        self.addCleanup(tools.APPROVALS.clear)

    def test_parse_answer(self):
        self.assertTrue(approvals.parse_answer("Yes"))
        self.assertTrue(approvals.parse_answer("yeah go ahead"))
        self.assertFalse(approvals.parse_answer("no, keep it"))
        self.assertFalse(approvals.parse_answer("Don't"))
        self.assertIsNone(approvals.parse_answer("what's the weather like tomorrow in Kochi"))
        self.assertIsNone(approvals.parse_answer("tell me a joke"))

    def test_forget_waits_for_approval(self):
        m = memories.remember("Vishnu likes filter coffee")
        result = tools.run_tool("forget", {"memory_id": m["id"]})
        self.assertTrue(result.ok)
        self.assertIn("Approval required", result.text)
        self.assertEqual(result.approval["tool"], "forget")
        self.assertIsNotNone(memories.get(m["id"]), "nothing is deleted before the yes")

        self.assertIn("left it", appu.resolve_approval(False).text)
        self.assertIsNotNone(memories.get(m["id"]))

        tools.run_tool("forget", {"memory_id": m["id"]})
        done = appu.resolve_approval(True)
        self.assertTrue(done.ok)
        self.assertIsNone(memories.get(m["id"]))
        self.assertIsNone(appu.resolve_approval(True), "an approval runs at most once")

    def test_forget_unknown_memory_does_not_ask(self):
        result = tools.run_tool("forget", {"memory_id": 404})
        self.assertFalse(result.ok)
        self.assertIsNone(tools.APPROVALS.pending())

    def test_wrong_id_and_expiry(self):
        m = memories.remember("Temporary fact")
        pending = tools.run_tool("forget", {"memory_id": m["id"]}).approval
        self.assertIsNone(appu.resolve_approval(True, pending["id"] + 1))
        with patch("approvals.time.time", return_value=time.time() + approvals.APPROVAL_TTL_SECONDS + 1):
            self.assertIsNone(appu.resolve_approval(True, pending["id"]))
        self.assertIsNotNone(memories.get(m["id"]))


class PromptAssemblyTests(TempDBTest):
    def test_context_includes_memories_and_previous_summary(self):
        memories.remember("Vishnu is on leave on Friday 6 November 2026")
        old = Conversation(persist=True)
        old.add_turn("plan the GPS release", "Sure.")
        conversation_store.save_summary(old.conversation_id, "- Planned the GPS release for Monday.")
        old.clear()

        current = Conversation(persist=True)
        context = appu.build_context("am I free on friday?", current)
        self.assertIn("on leave", context)
        self.assertIn("Planned the GPS release", context)

        current.rolling_summary = "- Talked about Kokoro voices."
        self.assertIn("Earlier in this conversation", appu.build_context("hi", current))

    def test_system_prompt_appends_context(self):
        prompt = appu.build_system_prompt(WEDNESDAY, context="What you know about the user:\n- likes tea")
        self.assertIn("Wednesday 28 October 2026", prompt)
        self.assertIn("Thursday 29 Oct, Friday 30 Oct", prompt)
        self.assertIn("Wednesday 4 Nov.", prompt)
        self.assertTrue(prompt.rstrip().endswith("- likes tea"))
        self.assertNotIn("What you know", appu.build_system_prompt(WEDNESDAY))


class ConversationStoreTests(TempDBTest):
    def test_turns_are_persisted_and_purged(self):
        conv = Conversation(persist=True)
        conv.add_turn("hello", "Hi Vishnu.")
        conv.add_turn("bye", "Bye.", interrupted=True)
        cid = conv.conversation_id
        transcript = conversation_store.conversation_transcript(cid)
        self.assertIn("User: hello", transcript)
        self.assertIn("[interrupted by the user]", transcript)

        self.assertEqual(conversation_store.purge_older_than(30), 0)
        conn = db.connect()
        conn.execute("UPDATE conversations SET started_at = ?", (time.time() - 40 * 86400,))
        conn.commit()
        conn.close()
        self.assertEqual(conversation_store.purge_older_than(30), 1)
        self.assertEqual(conversation_store.conversation_transcript(cid), "")

    def test_rolling_summary_trigger(self):
        conv = Conversation()
        with patch("appu.summarize_conversation", return_value="- summary") as summarize:
            for i in range(conversation_store.SUMMARY_EVERY_TURNS):
                conv.add_turn(f"q{i}", f"a{i}")
                appu.maybe_roll_summary(conv)
            for _ in range(50):
                if conv.rolling_summary:
                    break
                time.sleep(0.01)
        self.assertEqual(summarize.call_count, 1)
        self.assertEqual(conv.rolling_summary, "- summary")


if __name__ == "__main__":
    unittest.main()
