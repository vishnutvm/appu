"""
Tool registry building blocks.

Every tool declares a JSON schema for its arguments, a permission level and a
group (used to send the model only the tools relevant to a request).
"""

from dataclasses import dataclass, field
from typing import Callable, Dict, Optional

READ, WRITE, CONFIRM = "read", "write", "confirm"


@dataclass
class ToolResult:
    ok: bool
    text: str                       # what the model sees
    display: Optional[str] = None   # optional richer text for the screen
    speak: Optional[str] = None     # optional short spoken summary
    approval: Optional[Dict] = None  # set when a CONFIRM tool was parked for the user's yes/no


@dataclass
class Tool:
    name: str
    description: str
    parameters: Dict
    permission: str
    group: str
    handler: Callable[[Dict], ToolResult]
    # For CONFIRM tools: the question to ask the user, given validated arguments.
    confirm_prompt: Optional[Callable[[Dict], Optional[str]]] = None
    required: tuple = field(default=())

    def schema(self) -> Dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": self.parameters,
                    "required": list(self.required),
                },
            },
        }


class ArgumentError(ValueError):
    pass


def validate_arguments(tool: Tool, arguments) -> Dict:
    """Check arguments against the tool's schema. Unknown keys are dropped."""
    if not isinstance(arguments, dict):
        raise ArgumentError("invalid tool arguments.")
    clean = {}
    for name, spec in tool.parameters.items():
        if name not in arguments or arguments[name] is None:
            if name in tool.required:
                raise ArgumentError(f"{name} is required.")
            continue
        value = arguments[name]
        kind = spec.get("type")
        if kind == "integer":
            if isinstance(value, str) and value.strip().lstrip("#").isdigit():
                value = int(value.strip().lstrip("#"))
            if not isinstance(value, int) or isinstance(value, bool):
                raise ArgumentError(f"{name} must be an integer.")
        elif kind == "string":
            if not isinstance(value, str):
                raise ArgumentError(f"{name} must be a string.")
            value = value.strip()
            if name in tool.required and not value:
                raise ArgumentError(f"{name} cannot be empty.")
        if "enum" in spec and value not in spec["enum"]:
            raise ArgumentError(f"{name} must be one of: {', '.join(map(str, spec['enum']))}.")
        clean[name] = value
    return clean
