---
name: aw-tasks
description: >-
  How to create/edit/run/delete scheduled tasks through aw-app-tasks's
  /api/apps/tasks/* REST surface — a task fires a prompt into a reusable CLI
  session ("terminal" type) or runs a cheap command and notifies on a
  notable exit code ("agentic_output" type), on a schedule (once/daily/
  weekly/monthly/cron) or manually. Load this whenever a task needs to
  create, inspect, or trigger a scheduled/recurring job in this workspace.
---

# aw-tasks — scheduled prompts and command checks

This app ports the monolith's Scheduled Tasks feature
(`src/mcp/tasks.py` + `tools/agentic_output.py` + `src/api/task_manager.py`)
into a decoupled `aw-workspace` app. Every endpoint below is relative to
`/api/apps/tasks` (e.g. `GET /api/apps/tasks/tasks`).

## Task shape

```jsonc
{
  "id": "task-ab12cd34ef56",
  "name": "Daily standup digest",
  "type": "terminal" | "agentic_output",
  "cli_type": "terminal",            // terminal type only — the CLI the session runs
  "prompt": "…",                     // terminal type — text written into the session
  "command": "…",                    // agentic_output type — shell command to run
  "notify_exit_codes": null,         // agentic_output type — null/"" = any non-zero notifies
  "schedules": [{"kind": "cron", "expr": "0 9 * * *"}],
  "enabled": true,
  "session_id": "…",                 // terminal type — bound CLI session, once run
  "next_fire_at": 1234567890.0,      // epoch seconds, or null (manual-only / disabled)
  "last_run_at": 1234567890.0,
  "last_run_status": "ok" | "error",
  "runs": [{"id": "run-…", "started_at": …, "trigger": "manual"|"cron",
            "status": "ok"|"error", "exit_code": 0, "notified": false,
            "output": "…", "error": null}]
}
```

## Two task types

* **`terminal`** — on fire, ensures a reusable CLI session (named
  `"Task: <name>"`) exists via the workspace's terminals API and writes the
  prompt into it. Needs `config.terminals_api_base` set on this app (Apps
  card → Configure) — without it, runs record a clear `status=error`
  explaining that, instead of silently doing nothing.
* **`agentic_output`** — runs `command` directly (no LLM call). If the exit
  code is *notable* (any non-zero by default, or explicitly listed in
  `notify_exit_codes`), fires a workspace notification with the command,
  exit code, and (truncated) output. This is the type to reach for when you
  just want "run this check and tell me if it breaks" with zero cost on the
  happy path.

`agent_prompt` (call an Agents Platform agent) from the monolith is **not**
supported here — no Agents Platform app dependency is wired up yet.

## Schedules

Combine any number of entries in `schedules[]`; the task fires whenever the
soonest one is due. `once` schedules are dropped after firing.

```
{"kind": "once",    "at": "2026-08-10T09:00"}
{"kind": "daily",   "time": "09:00"}
{"kind": "weekly",  "days": [0,1,2,3,4], "time": "09:00"}   // 0=Mon..6=Sun
{"kind": "monthly", "day_of_month": 1, "time": "09:00"}
{"kind": "cron",    "expr": "0 9 * * *"}
```

Empty `schedules` = manual-only (fires only via the `run` endpoint below).
`POST /validate-cron {"cron": "…"}` and `POST /preview-schedules
{"schedules": [...]}` let you check a schedule before saving it.

## Endpoints

| Method & path | Does |
|---|---|
| `GET /tasks` | List every task (with embedded `runs[]`, newest first). |
| `POST /tasks` | Create. Body: `name` (required), `type`, `prompt`/`command`, `schedules`, `enabled`. |
| `GET /tasks/{id}` | Fetch one task. |
| `PUT /tasks/{id}` | Patch — only send the fields you want to change. |
| `DELETE /tasks/{id}` | Soft-delete (hidden, disabled). |
| `POST /tasks/{id}/run` | Fire now (`trigger=manual`), returns the run row. |
| `GET /ui` | The clickable Tasks window (vanilla HTML/JS, no build step). |

## Example: create-then-run an agentic_output task

```bash
curl -sX POST "$BASE/api/apps/tasks/tasks" -H 'content-type: application/json' -d '{
  "name": "ci-health-watch", "type": "agentic_output",
  "command": "./aw test aw --unit", "notify_exit_codes": null,
  "schedules": [], "enabled": true
}'
curl -sX POST "$BASE/api/apps/tasks/tasks/<id>/run"
```

The run's `exit_code`/`output`/`notified` land in the returned run row and
in `GET /tasks/<id>`'s `runs[]` — no need to poll a separate log.
