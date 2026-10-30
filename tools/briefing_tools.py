import briefing
from tools.base import READ, Tool, ToolResult


def _briefing(args) -> ToolResult:
    return ToolResult(True, briefing.daily_briefing()["text"])


def _suggest(args) -> ToolResult:
    suggestion = briefing.suggest_next()
    return ToolResult(True, suggestion or "Nothing pressing: no open tasks or reminders.")


TOOLS = [
    Tool(
        name="daily_briefing",
        description="The user's day: tasks due today, overdue tasks, reminders, and one suggestion. Use for 'good morning', 'what's on today', 'brief me'.",
        parameters={},
        permission=READ,
        group="briefing",
        handler=_briefing,
    ),
    Tool(
        name="suggest_next",
        description="Suggest what the user should do next, based on their tasks and reminders.",
        parameters={},
        permission=READ,
        group="briefing",
        handler=_suggest,
    ),
]
