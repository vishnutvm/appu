import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import appu
from reminders import create_reminder, init_db


class TestAppuIntegration(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_reminders.db"
        init_db(self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_appu_execute_tool_create_reminder(self):
        with patch("reminders.get_db_path", return_value=self.db_path):
            result = appu.execute_tool(
                "create_reminder",
                {"title": "Test integration reminder", "due_time": "in 15 minutes"},
            )
            self.assertIn("Scheduled:", result)
            self.assertIn("Test integration reminder", result)

    def test_appu_execute_tool_list_reminders(self):
        with patch("reminders.get_db_path", return_value=self.db_path):
            create_reminder("Test task", "in 5 minutes", db_path=self.db_path)
            result = appu.execute_tool("list_reminders", {"status": "pending"})
            self.assertIn("Reminders:", result)
            self.assertIn("Test task", result)

    def test_appu_execute_tool_cancel_reminder(self):
        with patch("reminders.get_db_path", return_value=self.db_path):
            res = create_reminder("Task to cancel", "in 10 minutes", db_path=self.db_path)
            cancel_result = appu.execute_tool("cancel_reminder", {"reminder_id": res["id"]})
            self.assertIn("Cancelled reminder", cancel_result)

    def test_appu_execute_tool_complete_reminder(self):
        with patch("reminders.get_db_path", return_value=self.db_path):
            res = create_reminder("Task to complete", "in 10 minutes", db_path=self.db_path)
            comp_result = appu.execute_tool("complete_reminder", {"reminder_id": res["id"]})
            self.assertIn("Marked reminder", comp_result)

    def test_appu_execute_tool_invalid_args_rejected(self):
        result = appu.execute_tool("create_reminder", "invalid-args")
        self.assertIn("Error:", result)

    @patch("appu.urlopen")
    def test_appu_ask_local_model_tool_call_loop(self, mock_urlopen):
        # Round 0: Ollama streams a tool call
        round0_lines = [
            json.dumps({"message": {"content": "Planning reminder...", "tool_calls": [{
                "function": {"name": "create_reminder", "arguments": {"title": "Backup db", "due_time": "in 5 minutes"}}
            }]}}).encode("utf-8") + b"\n",
            json.dumps({"done": True}).encode("utf-8") + b"\n"
        ]

        # Round 1: Ollama returns final answer
        round1_lines = [
            json.dumps({"message": {"content": "I have scheduled the backup reminder."}}).encode("utf-8") + b"\n",
            json.dumps({"done": True}).encode("utf-8") + b"\n"
        ]

        resp0 = MagicMock()
        del resp0.body
        resp0.__iter__.return_value = iter(round0_lines)
        resp1 = MagicMock()
        del resp1.body
        resp1.__iter__.return_value = iter(round1_lines)

        mock_urlopen.return_value.__enter__.side_effect = [resp0, resp1]

        tokens = []
        with patch("reminders.get_db_path", return_value=self.db_path):
            ans = appu.ask_local_model("Backup db in 5 minutes", on_token=tokens.append)

        self.assertIn("I have scheduled the backup reminder.", ans)
        self.assertIn("Planning reminder...", tokens)
        self.assertIn("I have scheduled the backup reminder.", tokens)

    @patch("appu.urlopen")
    def test_appu_ask_local_model_direct_answer(self, mock_urlopen):
        resp_lines = [
            json.dumps({"message": {"content": "Hello there! "}}).encode("utf-8") + b"\n",
            json.dumps({"message": {"content": "How can I help you today?"}}).encode("utf-8") + b"\n",
            json.dumps({"done": True}).encode("utf-8") + b"\n"
        ]
        resp = MagicMock()
        del resp.body
        resp.__iter__.return_value = iter(resp_lines)
        mock_urlopen.return_value.__enter__.return_value = resp

        tokens = []
        ans = appu.ask_local_model("Hi", on_token=tokens.append)
        self.assertEqual(ans, "Hello there! How can I help you today?")
        self.assertEqual(tokens, ["Hello there! ", "How can I help you today?"])


if __name__ == "__main__":
    unittest.main()
