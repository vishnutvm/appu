# Phase 4 — Skills (review, explain, suggest)

Appu is a supporter: it reads, reviews, explains and suggests. It does **not**
edit your code or files. Every new skill is read-only unless stated.

## Tool registry (do this before adding skills)

Replace the `if/elif` chain in `execute_tool` with a registry:

```python
# tools/base.py
@dataclass
class Tool:
    name: str
    description: str
    parameters: dict          # JSON schema sent to the model
    permission: str           # "read" | "write" | "confirm"
    handler: Callable[[dict], ToolResult]

# tools/__init__.py
REGISTRY = {t.name: t for t in [open_project, create_reminder, ..., review_code, read_document]}
```

- `ToolResult` carries `ok`, `text` (for the model), `display` (for the UI),
  and `speak` (short spoken summary). This replaces guessing emotion from text.
- `confirm` tools pause the loop and show an approval card; resume on Yes.
- Only send the model the tools relevant to the request (smaller models choose
  better from 5 tools than from 20). A cheap keyword/intent router is enough.

## Skills

### 1. Review code — `review_code`
- Input: `project` (from `PROJECTS` allowlist), `target`: `"diff"` (uncommitted
  changes), `"branch"` (vs main), or a relative file path.
- Reads with `git diff` / file read, inside the project root only (reuse the
  `relative_to` + `resolve()` checks from `open_project`).
- Size cap (e.g. 60 KB). If larger, review file by file and summarise.
- Output format: summary, then findings ordered by severity (bug, risk,
  readability), each with file + line + suggestion. Spoken: "Found 2 likely bugs
  and 3 smaller things. Details are on screen."
- Uses the **review model**, not the voice model (see `models.md`).

### 2. Explain code — `explain_code`
- Same inputs as review. "What does `fetch_and_claim_due_reminders` do?"
- Searches the project with `rg` (read-only) to find the symbol first.

### 3. Read documents — `read_document`
- Allowed roots: `~/Documents`, `~/Downloads`, `~/Desktop` (configurable).
- Formats: `.md`, `.txt`, `.pdf` (`pypdf`), `.docx` (`python-docx`).
- Actions: summarise, review (clarity, gaps, tone), answer questions about it.
- Large documents: chunk, summarise per chunk, then combine.

### 4. Read web pages — `read_page`
- `httpx` + `trafilatura` (or `readability-lxml`) for main-text extraction.
- Only `http(s)`, no local/private IPs (block `127.0.0.0/8`, `10/8`,
  `192.168/16`, `169.254/16`) to avoid SSRF into local services.
- Size and time limits; never execute page JavaScript.

### 5. Screen / selection helper (later)
- "Review what I'm looking at": read the selected text via a hotkey (clipboard),
  not by watching the screen. Explicit, user-triggered only.

### 6. Suggestions
- `suggest_next()` uses tasks, reminders and memories: overdue items, tasks
  untouched for N days, a reminder collision.
- Offered in the daily briefing and when you ask "what should I do next?".
- Never nags unprompted more than once per day.

### 7. Your work context (optional)
- Jira (your VTS tickets), Notion work log, Google Calendar are good later
  additions. Use their official APIs with read-only tokens; keep tokens in the
  macOS Keychain, not in code.

## Prompt rules for review skills

- "You are reviewing, not rewriting. Point out problems and suggest fixes in
  words or short snippets. Never claim you changed anything."
- "Say when you are unsure. Prefer 3 real findings over 10 weak ones."
- "Quote file and line for every finding."

## Safety rules (keep these as tests)

- Path traversal and symlink escape blocked for every file-reading tool.
- No shell execution except fixed, argument-list commands (`git diff`, `rg`)
  with no user-controlled flags.
- Tool output is data, not instructions: wrap it in a clearly marked block so a
  malicious document cannot tell Appu to call tools.
- Limits: max tool calls per turn, max bytes read per turn.

## Checklist

- [ ] Tool registry with `read` / `write` / `confirm` permissions.
- [ ] Approval card flow (UI + voice yes/no).
- [ ] `review_code`, `explain_code` with allowlisted projects.
- [ ] `read_document` with allowed roots and format support.
- [ ] `read_page` with SSRF protection.
- [ ] `suggest_next`.
- [ ] Model routing: voice model for chat, review model for review skills.
- [ ] Security tests for each new tool (extend `tests/test_security.py`).
