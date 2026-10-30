import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import appu
from appu import execute_tool


class FakeOllamaResponse:
    def __init__(self, message):
        line = json.dumps({"message": message}).encode("utf-8") + b"\n"
        done = json.dumps({"done": True}).encode("utf-8") + b"\n"
        self._lines = [line, done]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def __iter__(self):
        return iter(self._lines)

    def read(self):
        return b"".join(self._lines)


def make_tool_call(name="open_project", arguments=None):
    return {
        "function": {
            "name": name,
            "arguments": arguments or {"project_name": "jarvis"},
        }
    }


class ToolSecurityTests(unittest.TestCase):
    def test_unregistered_project_is_denied(self):
        result = execute_tool(
            "open_project",
            {"project_name": "secret-project"},
        )
        self.assertTrue(result.startswith("Denied:"))

    def test_unknown_tool_is_denied(self):
        result = execute_tool(
            "run_shell",
            {"command": "some-command"},
        )
        self.assertTrue(result.startswith("Denied:"))

    def test_non_dictionary_arguments_are_rejected(self):
        result = execute_tool(
            "open_project",
            ["jarvis"],
        )
        self.assertTrue(result.startswith("Error:"))

    def test_missing_project_name_is_rejected(self):
        result = execute_tool(
            "open_project",
            {},
        )
        self.assertTrue(result.startswith("Error:"))

    def test_non_string_project_name_is_rejected(self):
        result = execute_tool(
            "open_project",
            {"project_name": 123},
        )
        self.assertTrue(result.startswith("Error:"))

    @patch("appu.subprocess.Popen")
    def test_registered_project_is_whitelisted(self, mock_popen):
        result = execute_tool(
            "open_project",
            {"project_name": "jarvis"},
        )
        self.assertFalse(result.startswith("Denied:"))

    def test_unknown_tool_does_not_launch_application(self):
        with patch("appu.subprocess.Popen") as mock_popen:
            result = execute_tool(
                "run_shell",
                {"command": "open something"},
            )
        self.assertTrue(result.startswith("Denied:"))
        mock_popen.assert_not_called()

    def test_unregistered_project_does_not_launch_application(self):
        with patch("appu.subprocess.Popen") as mock_popen:
            result = execute_tool(
                "open_project",
                {"project_name": "secret-project"},
            )
        self.assertTrue(result.startswith("Denied:"))
        mock_popen.assert_not_called()

    def test_project_outside_approved_root_is_denied(self):
        with tempfile.TemporaryDirectory() as outside_dir:
            with (
                patch.dict(
                    appu.PROJECTS,
                    {"external-test": Path(outside_dir)},
                    clear=True,
                ),
                patch("appu.subprocess.Popen") as mock_popen,
            ):
                result = execute_tool(
                    "open_project",
                    {"project_name": "external-test"},
                )
        self.assertTrue(result.startswith("Denied:"))
        mock_popen.assert_not_called()

    def test_repeated_tool_call_stops_before_second_execution(self):
        repeated_message = {
            "role": "assistant",
            "content": "",
            "tool_calls": [make_tool_call()],
        }
        responses = [
            FakeOllamaResponse(repeated_message),
            FakeOllamaResponse(repeated_message),
        ]
        with (
            patch("appu.urlopen", side_effect=responses),
            patch("appu.run_tool", return_value=appu.ToolOutcome(True, "Opened")) as mock_tool,
        ):
            with self.assertRaisesRegex(RuntimeError, "repeated"):
                appu.ask_local_model("Open the JARVIS project")
        self.assertEqual(mock_tool.call_count, 1)

    def test_oversized_tool_batch_executes_nothing(self):
        message = {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                make_tool_call(arguments={"project_name": f"project-{i}"})
                for i in range(appu.MAX_TOOL_CALLS + 1)
            ],
        }
        with (
            patch(
                "appu.urlopen",
                return_value=FakeOllamaResponse(message),
            ),
            patch("appu.run_tool") as mock_tool,
        ):
            with self.assertRaisesRegex(RuntimeError, "limit"):
                appu.ask_local_model("Open the JARVIS project")
        self.assertEqual(mock_tool.call_count, 0)


if __name__ == "__main__":
    unittest.main()
