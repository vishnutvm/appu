import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import MagicMock, patch

from reminders import (
    cancel_reminder,
    complete_reminder,
    create_reminder,
    fetch_and_claim_due_reminders,
    get_due_reminders,
    init_db,
    list_reminders,
    mark_reminder_notified,
    parse_due_time,
    send_macos_notification,
)


class TestReminders(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_reminders.db"
        init_db(self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_parse_due_time_relative(self):
        ts, time_str = parse_due_time("in 5 minutes")
        self.assertGreater(ts, time.time())
        self.assertIn(":", time_str)

        ts2, _ = parse_due_time("in 30 seconds")
        self.assertGreater(ts2, time.time())

        ts3, _ = parse_due_time("2 hours from now")
        self.assertGreater(ts3, time.time())

    def test_parse_due_time_invalid(self):
        with self.assertRaises(ValueError):
            parse_due_time("whenever you feel like it")

    def test_create_and_list_reminders(self):
        res = create_reminder("Review pull request", "in 10 minutes", db_path=self.db_path)
        self.assertEqual(res["title"], "Review pull request")
        self.assertEqual(res["status"], "pending")
        self.assertIn("scheduled for", res["message"])

        reminders = list_reminders(status="pending", db_path=self.db_path)
        self.assertEqual(len(reminders), 1)
        self.assertEqual(reminders[0]["title"], "Review pull request")

    def test_empty_title_rejected(self):
        with self.assertRaises(ValueError):
            create_reminder("   ", "in 10 minutes", db_path=self.db_path)

    def test_cancel_reminder(self):
        res = create_reminder("Call client", "in 1 hour", db_path=self.db_path)
        cancel_res = cancel_reminder(res["id"], db_path=self.db_path)
        self.assertTrue(cancel_res["success"])

        pending = list_reminders(status="pending", db_path=self.db_path)
        self.assertEqual(len(pending), 0)

        cancelled = list_reminders(status="cancelled", db_path=self.db_path)
        self.assertEqual(len(cancelled), 1)
        self.assertEqual(cancelled[0]["status"], "cancelled")

    def test_complete_reminder(self):
        res = create_reminder("Submit invoice", "in 1 hour", db_path=self.db_path)
        comp_res = complete_reminder(res["id"], db_path=self.db_path)
        self.assertTrue(comp_res["success"])

        completed = list_reminders(status="completed", db_path=self.db_path)
        self.assertEqual(len(completed), 1)
        self.assertEqual(completed[0]["status"], "completed")

    def test_due_reminders_and_notification(self):
        # Create reminder 1 second in the future
        res = create_reminder("Quick alert", "in 1 seconds", db_path=self.db_path)
        time.sleep(1.1)

        due = get_due_reminders(db_path=self.db_path)
        self.assertEqual(len(due), 1)
        self.assertEqual(due[0]["id"], res["id"])

        mark_reminder_notified(res["id"], db_path=self.db_path)
        due_after = get_due_reminders(db_path=self.db_path)
        self.assertEqual(len(due_after), 0)

    def test_parse_12hr_formats(self):
        ts1, s1 = parse_due_time("5:30 pm")
        self.assertGreater(ts1, time.time())
        ts2, s2 = parse_due_time("tomorrow at 9am")
        self.assertGreater(ts2, time.time())

    def test_atomic_claim_due_reminders(self):
        r1 = create_reminder("Task 1", "in 1 seconds", db_path=self.db_path)
        r2 = create_reminder("Task 2", "in 1 seconds", db_path=self.db_path)
        time.sleep(1.1)

        claimed1 = fetch_and_claim_due_reminders(db_path=self.db_path)
        self.assertEqual(len(claimed1), 2)
        self.assertEqual(claimed1[0]["status"], "notified")

        # Second claim returns empty (zero duplicate delivery)
        claimed2 = fetch_and_claim_due_reminders(db_path=self.db_path)
        self.assertEqual(len(claimed2), 0)

    def test_concurrent_db_access(self):
        import threading
        errors = []

        def worker_writer(idx):
            try:
                for i in range(10):
                    create_reminder(f"Thread {idx} Task {i}", "in 1 hour", db_path=self.db_path)
            except Exception as e:
                errors.append(e)

        def worker_reader():
            try:
                for _ in range(10):
                    list_reminders(db_path=self.db_path)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker_writer, args=(i,)) for i in range(3)]
        threads += [threading.Thread(target=worker_reader) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0, f"Concurrent database access caused errors: {errors}")

    @patch("subprocess.Popen")
    def test_send_macos_notification(self, mock_popen):
        success = send_macos_notification("Appu", "Task completed")
        self.assertTrue(success)
        mock_popen.assert_called_once()


if __name__ == "__main__":
    unittest.main()
