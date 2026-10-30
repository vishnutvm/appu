import tasks
from tools.base import READ, WRITE, Tool, ToolResult


def _add(args) -> ToolResult:
    task = tasks.add_task(
        args["title"],
        due=args.get("due") or None,
        priority=args.get("priority", 2),
        project=args.get("project") or None,
    )
    return ToolResult(True, f"Added task {tasks.format_task(task)}.")


def _list(args) -> ToolResult:
    flt = args.get("filter", "open")
    items = tasks.list_tasks(flt, project=args.get("project") or None)
    if not items:
        return ToolResult(True, f"No tasks ({flt}).")
    return ToolResult(True, f"Tasks ({flt}):\n" + "\n".join(f"- {tasks.format_task(t)}" for t in items))


def _update(args) -> ToolResult:
    task = tasks.update_task(
        args["task_id"],
        status=args.get("status"),
        due=args.get("due"),
        priority=args.get("priority"),
        title=args.get("title"),
    )
    if task is None:
        return ToolResult(False, f"Task #{args['task_id']} not found.")
    return ToolResult(True, f"Updated task {tasks.format_task(task)}.")


TOOLS = [
    Tool(
        name="add_task",
        description="Add something the user needs to do (a to-do). Use create_reminder instead if they want an alert at a time.",
        parameters={
            "title": {"type": "string", "description": "The task, e.g. 'Finish GPS ticket review'."},
            "due": {"type": "string", "description": "Optional due date: 'today', 'tomorrow', 'friday', 'next monday', 'in 3 days', '2026-11-06'."},
            "priority": {"type": "integer", "enum": [1, 2, 3], "description": "1 high, 2 normal (default), 3 low."},
            "project": {"type": "string", "description": "Optional project name."},
        },
        required=("title",),
        permission=WRITE,
        group="tasks",
        handler=_add,
    ),
    Tool(
        name="list_tasks",
        description="List the user's tasks. 'today' includes overdue ones.",
        parameters={
            "filter": {"type": "string", "enum": list(tasks.FILTERS), "description": "Which tasks. Defaults to 'open'."},
            "project": {"type": "string", "description": "Optional project name."},
        },
        permission=READ,
        group="tasks",
        handler=_list,
    ),
    Tool(
        name="update_task",
        description="Change a task by ID: mark it done/doing/dropped, move its due date, change priority or title.",
        parameters={
            "task_id": {"type": "integer", "description": "Numeric ID of the task."},
            "status": {"type": "string", "enum": list(tasks.STATUSES)},
            "due": {"type": "string", "description": "New due date, e.g. 'tomorrow', or 'none' to clear."},
            "priority": {"type": "integer", "enum": [1, 2, 3]},
            "title": {"type": "string"},
        },
        required=("task_id",),
        permission=WRITE,
        group="tasks",
        handler=_update,
    ),
]
