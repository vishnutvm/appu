"""
Tool registry, dispatcher and router.

- run_tool() validates arguments and runs a registered tool. CONFIRM tools are
  parked in approvals.APPROVALS instead of running.
- select_tools() picks the tool groups relevant to a message, so the small voice
  model chooses from a handful of tools instead of all of them.
"""

import re
from typing import Dict, Iterable, List

from approvals import APPROVALS, PendingApproval
from tools import briefing_tools, memory_tools, projects, reminder_tools, task_tools
from tools.base import CONFIRM, ArgumentError, Tool, ToolResult, validate_arguments

REGISTRY: Dict[str, Tool] = {
    t.name: t
    for module in (projects, reminder_tools, task_tools, memory_tools, briefing_tools)
    for t in module.TOOLS
}

GROUP_KEYWORDS = {
    "reminders": r"remind|reminder|alert|alarm|notify|ping me|wake me",
    "tasks": r"task|to-?do|to do|need to|have to|got to|finish|done|complete|priority|due|deadline|"
             r"push|postpone|move|drop|today|tomorrow|this week|my list|on my plate|work on",
    "memory": r"remember|forget|recall|you know|do you know|what('?s| is) my|who is|did i (tell|say|mention)|"
              r"prefer|favou?rite|free on|am i free|busy|on leave|holiday|birthday|my (wife|husband|manager|boss|friend)",
    "projects": r"\bopen\b|vs ?code|editor|project",
    "briefing": r"good morning|morning|brief|agenda|what'?s on|plan for (the|my) day|what should i do|"
                r"what next|what'?s next|suggest",
}
_GROUP_PATTERNS = {g: re.compile(p, re.I) for g, p in GROUP_KEYWORDS.items()}

MAX_TOOLS_PER_REQUEST = 8


def groups_for(message: str) -> List[str]:
    return [g for g, pattern in _GROUP_PATTERNS.items() if pattern.search(message)]


def select_tools(message: str, recent_groups: Iterable[str] = ()) -> List[Tool]:
    """Tools for this request: groups matched by keywords plus groups used in the last turn."""
    groups = list(dict.fromkeys([*groups_for(message), *recent_groups]))
    if "briefing" in groups and "tasks" not in groups:
        groups.append("tasks")
    selected = [t for t in REGISTRY.values() if t.group in groups]
    return selected[:MAX_TOOLS_PER_REQUEST]


def schemas(tools: Iterable[Tool]) -> List[Dict]:
    return [t.schema() for t in tools]


def run_tool(name: str, arguments) -> ToolResult:
    """Dispatch only explicitly registered tools."""
    tool = REGISTRY.get(name)
    if tool is None:
        return ToolResult(False, "Denied: this tool is not registered.")
    try:
        args = validate_arguments(tool, arguments)
    except ArgumentError as exc:
        return ToolResult(False, f"Error: {exc}")

    if tool.permission == CONFIRM:
        prompt = tool.confirm_prompt(args) if tool.confirm_prompt else f"Run {tool.name}?"
        if prompt is None:
            return ToolResult(False, "Error: nothing matches that ID.")
        pending = APPROVALS.request(tool.name, args, prompt)
        return ToolResult(
            True,
            f"Approval required. Nothing has been changed yet. Ask the user exactly: {prompt} "
            "They can answer yes or no.",
            display=prompt,
            speak=prompt,
            approval=pending.to_event(),
        )
    return _execute(tool, args)


def run_approved(pending: PendingApproval) -> ToolResult:
    tool = REGISTRY.get(pending.tool_name)
    if tool is None:
        return ToolResult(False, "Denied: this tool is not registered.")
    return _execute(tool, pending.arguments)


def _execute(tool: Tool, args: Dict) -> ToolResult:
    try:
        return tool.handler(args)
    except ValueError as exc:
        return ToolResult(False, f"Error: {exc}")
    except Exception as exc:
        return ToolResult(False, f"Error running {tool.name}: {exc}")


__all__ = [
    "REGISTRY", "ToolResult", "run_tool", "run_approved", "select_tools", "schemas", "groups_for",
]
