import memories
from tools.base import CONFIRM, READ, WRITE, Tool, ToolResult


def _remember(args) -> ToolResult:
    memory = memories.remember(args["content"], kind=args.get("kind", "fact"))
    return ToolResult(True, f"Saved to memory (#{memory['id']}): {memory['content']}")


def _recall(args) -> ToolResult:
    found = memories.recall(args["query"])
    if not found:
        return ToolResult(True, "Nothing in memory matches that.")
    lines = [f"#{m['id']} (saved {m['saved_on']}): {m['content']}" for m in found]
    return ToolResult(True, "From memory:\n" + "\n".join(lines))


def _forget(args) -> ToolResult:
    memory = memories.get(args["memory_id"])
    if memory is None or not memories.forget(args["memory_id"]):
        return ToolResult(False, f"Memory #{args['memory_id']} not found.")
    return ToolResult(True, f"Forgot: {memory['content']}")


def _forget_prompt(args):
    memory = memories.get(args["memory_id"])
    if memory is None:
        return None
    return f"Forget that \"{memory['content']}\"?"


TOOLS = [
    Tool(
        name="remember",
        description=(
            "Save a fact or preference to long-term memory. Only when the user says 'remember...' "
            "or clearly states a lasting preference. Write it in third person about the user, Vishnu "
            "(never about Appu), and turn relative dates into absolute ones, "
            "e.g. 'Vishnu is on leave on Friday 6 November 2026'."
        ),
        parameters={
            "content": {"type": "string", "description": "The fact to remember, self-contained."},
            "kind": {"type": "string", "enum": list(memories.KINDS)},
        },
        required=("content",),
        permission=WRITE,
        group="memory",
        handler=_remember,
    ),
    Tool(
        name="recall",
        description="Search long-term memory for facts about the user.",
        parameters={"query": {"type": "string", "description": "Keywords to look for."}},
        required=("query",),
        permission=READ,
        group="memory",
        handler=_recall,
    ),
    Tool(
        name="forget",
        description="Delete a memory by ID. The user will be asked to confirm.",
        parameters={"memory_id": {"type": "integer", "description": "Numeric ID of the memory (shown as #id)."}},
        required=("memory_id",),
        permission=CONFIRM,
        group="memory",
        handler=_forget,
        confirm_prompt=_forget_prompt,
    ),
]
