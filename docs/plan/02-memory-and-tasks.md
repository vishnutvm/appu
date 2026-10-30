# Phase 2 — Memory, Tasks and Daily Briefing

Makes Appu a personal assistant rather than a stateless chatbot.

## Three kinds of memory

| Kind | Lifetime | Storage | Example |
|---|---|---|---|
| Conversation | One session | In memory, summarised when long | "the second one" refers to the last list |
| Long-term facts | Until you delete them | SQLite `memories` table (+ optional embeddings) | "I prefer meetings after 11am", "my manager is Arun" |
| Tasks and reminders | Until done | SQLite `tasks`, `reminders` | "Finish GPS ticket review by Friday" |

Keep everything in one SQLite file (e.g. `data/appu.db`); migrate `reminders.db` into it.

## Schema sketch

```sql
CREATE TABLE memories (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,          -- "Vishnu prefers short spoken answers"
  kind TEXT NOT NULL,             -- fact | preference | person | project
  source TEXT,                    -- "user said" | "inferred"
  created_at REAL NOT NULL,
  last_used_at REAL,
  embedding BLOB                  -- optional, for semantic recall
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL CHECK(status IN ('open','doing','done','dropped')),
  priority INTEGER DEFAULT 2,     -- 1 high, 2 normal, 3 low
  due_at REAL,
  project TEXT,
  created_at REAL NOT NULL,
  completed_at REAL
);

CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
  started_at REAL NOT NULL,
  summary TEXT                    -- rolling summary, used to seed the next session
);
```

Reminders stay separate: a reminder is "alert me at time X"; a task is "something
I need to do". A task can have a reminder attached (`reminders.task_id`).

## Tools to add

| Tool | Permission | Notes |
|---|---|---|
| `remember(content, kind)` | write, no confirmation | Only when you say "remember…" or state a clear preference |
| `recall(query)` | read | Keyword search first; semantic search when embeddings exist |
| `forget(memory_id)` | write, **confirm** | Confirm by voice: "Forget that you prefer X?" |
| `add_task(title, due, priority, project)` | write | |
| `list_tasks(filter)` | read | today / overdue / project / all |
| `update_task(id, status / due / priority)` | write | |
| `daily_briefing()` | read | Tasks due today, overdue, reminders, one suggestion |

## How memory gets into the prompt

1. At session start: system prompt + short profile (top ~10 most used memories) +
   last conversation summary.
2. Each turn: `recall` the 3–5 memories most relevant to the message and add them
   as a short "What you know about Vishnu" block.
3. Every ~10 turns or at session end: ask the model to summarise the conversation
   into `conversations.summary` and propose new memories. Save proposals only if
   they are explicit ("remember…") or ask once: "Should I remember that?".

Embeddings: start without them (SQLite FTS5 keyword search is enough for
hundreds of memories). Add a local embedding model later (see `models.md`).

## Daily briefing

- Trigger: first time you open Appu each day, or "good morning".
- Content, spoken in ~20 seconds: greeting, number of tasks today, the top one,
  overdue items, next reminder, one suggestion ("You haven't touched X since Monday").
- Full list shown on screen.

## Transparency (important for trust)

- UI panel "What Appu remembers" listing every memory with delete buttons.
- Appu never stores raw audio. Transcripts stay in the local DB; add a setting
  to auto-delete conversation history after N days.

## Checklist

- [ ] Create `data/appu.db`, migrate reminders, add `memories`, `tasks`, `conversations`.
- [ ] Add FTS5 index on `memories.content` and `tasks.title`.
- [ ] Implement the tools above in a `tools/` package with a registry (see `04-skills.md`).
- [ ] Inject profile + relevant memories + last summary into the prompt.
- [ ] Rolling conversation summary.
- [ ] Daily briefing.
- [ ] "What Appu remembers" panel with delete.
- [ ] Tests: memory CRUD, recall ranking, task filters, briefing content, prompt assembly.

## Done when

- "Remember I'm on leave next Friday" → next week, "am I free Friday?" gets the right answer.
- "What do I need to do today?" reads tasks and reminders correctly.
- You can see and delete everything Appu remembers.
