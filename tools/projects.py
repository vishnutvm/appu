from pathlib import Path
import shutil
import subprocess

from tools.base import WRITE, Tool, ToolResult

# Explicit registry: the model cannot supply arbitrary filesystem paths.
PROJECTS = {
    "appu": Path.home() / "Developer" / "appu",
    "jarvis": Path.home() / "Developer" / "jarvis",
}


def resolve_project(project_name: str):
    """Return (path, None) for a registered project inside ~/Developer, or (None, error)."""
    if project_name not in PROJECTS:
        return None, "Denied: that project is not registered."
    try:
        approved_root = (Path.home() / "Developer").resolve()
        project_path = PROJECTS[project_name].resolve()
        try:
            project_path.relative_to(approved_root)
        except ValueError:
            return None, "Denied: the project path is outside the approved directory."
        if project_path == approved_root:
            return None, "Denied: the project path must be inside Developer."
        if not project_path.is_dir():
            return None, "Error: the registered project folder does not exist."
    except (OSError, RuntimeError):
        return None, "Error: could not safely validate the project path."
    return project_path, None


def open_project(project_name: str) -> str:
    """Open only a registered project inside the approved Developer directory."""
    project_path, error = resolve_project(project_name)
    if error:
        return error

    code_path = shutil.which("code")
    if not code_path:
        return "VS Code's 'code' launcher was not found. Install it through VS Code's Command Palette."

    try:
        subprocess.Popen(
            [code_path, str(project_path)],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        return "Error: macOS could not launch VS Code."
    return f"Opened the {project_name} project in VS Code."


def _open_project(args) -> ToolResult:
    text = open_project(args["project_name"])
    return ToolResult(text.startswith("Opened"), text)


OPEN_PROJECT = Tool(
    name="open_project",
    description="Open a registered project folder in Visual Studio Code. ONLY call when the user explicitly asks to open a project or VS Code.",
    parameters={
        # No enum: an unknown name must reach resolve_project and be denied, not rejected as a typo.
        "project_name": {"type": "string", "description": f"Registered project: {', '.join(PROJECTS)}."},
    },
    required=("project_name",),
    permission=WRITE,
    group="projects",
    handler=_open_project,
)

TOOLS = [OPEN_PROJECT]
