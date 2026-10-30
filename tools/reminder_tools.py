import reminders
from tools.base import READ, WRITE, Tool, ToolResult


def _create(args) -> ToolResult:
    res = reminders.create_reminder(args["title"], args["due_time"])
    return ToolResult(True, f"Scheduled: {res['message']}")


def _list(args) -> ToolResult:
    status = args.get("status", "pending")
    items = reminders.list_reminders(status=None if status == "all" else status)
    if not items:
        return ToolResult(True, "No reminders found.")
    lines = [f"#{r['id']} [{r['status'].upper()}] {r['title']} (due: {r['due_time']})" for r in items]
    return ToolResult(True, "Reminders:\n" + "\n".join(lines))


def _cancel(args) -> ToolResult:
    res = reminders.cancel_reminder(args["reminder_id"])
    return ToolResult(bool(res["success"]), res["message"])


def _complete(args) -> ToolResult:
    res = reminders.complete_reminder(args["reminder_id"])
    return ToolResult(bool(res["success"]), res["message"])


REMINDER_ID = {"reminder_id": {"type": "integer", "description": "Numeric ID of the reminder."}}

TOOLS = [
    Tool(
        name="create_reminder",
        description="Schedule an alert at a specific time.",
        parameters={
            "title": {"type": "string", "description": "What to remind the user about."},
            "due_time": {"type": "string", "description": (
                "The user's own words for the time, e.g. '6pm', 'in 10 minutes', 'tomorrow at 9am', "
                "'friday at 5pm'. Do not add a day the user did not say: '6pm' means today at 6pm."
            )},
        },
        required=("title", "due_time"),
        permission=WRITE,
        group="reminders",
        handler=_create,
    ),
    Tool(
        name="list_reminders",
        description="List reminders, optionally filtered by status.",
        parameters={
            "status": {"type": "string", "enum": ["pending", "notified", "completed", "cancelled", "all"],
                       "description": "Status filter. Defaults to 'pending'."},
        },
        permission=READ,
        group="reminders",
        handler=_list,
    ),
    Tool(
        name="cancel_reminder",
        description="Cancel a pending reminder by ID.",
        parameters=REMINDER_ID,
        required=("reminder_id",),
        permission=WRITE,
        group="reminders",
        handler=_cancel,
    ),
    Tool(
        name="complete_reminder",
        description="Mark a reminder as completed by ID.",
        parameters=REMINDER_ID,
        required=("reminder_id",),
        permission=WRITE,
        group="reminders",
        handler=_complete,
    ),
]
