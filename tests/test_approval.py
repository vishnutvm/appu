import tempfile
from pathlib import Path
import unittest

from reminders import (
    create_reminder,
    list_reminders,
    cancel_reminder,
    init_db,
)


def delete_all_reminders_safely(confirmed: bool = False, db_path: Path = None) -> str:
    """Destructive action: requires explicit confirmation before purging data."""
    if not confirmed:
        return "Approval required: Deleting all reminders is a destructive action. Explicit confirmation required."

    import sqlite3
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM reminders")
        conn.commit()
        return "Success: All reminders have been cleared."
    finally:
        conn.close()


class TestApprovalChecks(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_reminders.db"
        init_db(self.db_path)
        create_reminder("Task 1", "in 10 minutes", db_path=self.db_path)
        create_reminder("Task 2", "in 20 minutes", db_path=self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_destructive_purge_denied_without_confirmation(self):
        result = delete_all_reminders_safely(confirmed=False, db_path=self.db_path)
        self.assertIn("Approval required", result)
        # Verify no data was deleted
        reminders = list_reminders(db_path=self.db_path)
        self.assertEqual(len(reminders), 2)

    def test_destructive_purge_allowed_with_confirmation(self):
        result = delete_all_reminders_safely(confirmed=True, db_path=self.db_path)
        self.assertIn("Success", result)
        reminders = list_reminders(db_path=self.db_path)
        self.assertEqual(len(reminders), 0)


if __name__ == "__main__":
    unittest.main()
