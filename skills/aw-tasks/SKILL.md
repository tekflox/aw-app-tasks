---
name: aw-tasks
description: >-
  Create/edit/run/delete this workspace's scheduled tasks — either through the
  aw-tasks MCP tools (list_tasks, get_task, create_task, update_task,
  delete_task, run_task, open_task, list_clis) or the /api/apps/tasks/* REST
  surface behind them. A task calls an Agents Platform agent
  ("agent_prompt"), runs a cheap command and only pays for an agent when the
  exit code is notable ("agentic_output"), or writes a prompt into a reusable
  CLI session ("terminal"), on a schedule (once/daily/weekly/monthly/cron) or
  manually. Load this whenever a task needs to create, inspect, or trigger a
  scheduled/recurring job in this workspace.
---

# aw-tasks — scheduled prompts and command checks

This app ports the monolith's Scheduled Tasks feature (`src/mcp/tasks.py` +
`tools/agentic_output.py` + `src/api/task_manager.py`) into a decoupled
`aw-workspace` app. There are two ways in and they sit on the same store:

* **MCP** — the eight tools below, through `aw-gateway`. **Prefer this.**
* **REST** — `/api/apps/tasks/*`, for curl, the UI and tests.

## MCP tools

Through the gateway they are named `mcp__aw-gateway__aw__tasks__<tool>`
(drop the `aw-gateway__` layer if your session mounts `tasks` directly).

| Tool | Does |
|---|---|
| `list_tasks` | Every task, summarised: type, enabled, schedules, next fire, last outcome. |
| `get_task` | One task in full, with its recent `runs[]`. |
| `create_task` | Create. Validated first — see the two refusals below. |
| `update_task` | Patch; send only what changes. |
| `delete_task` | Soft-delete (hidden + disabled; run history survives). |
| `run_task` | Fire now, regardless of schedule or `enabled`. |
| `open_task` | **What happened last run**: status, exit code, output, error, and the Agents Platform run id. |
| `list_clis` | The agent slugs you may pass as `agent_slug`, plus valid `cli_type`s and schedule kinds. |

`open_task` is deliberately **not** the monolith's tool of the same name. There
it returned a `terminal` task's bound CLI session plus its scrollback. That
type has never worked properly in this workspace, and what tasks actually run
here is `agent_prompt`/`agentic_output` — so the tool answers the question the
caller was really asking, off the run rows this app already keeps.

### Two things `create_task` refuses

1. **An `agent_prompt` or `agentic_output` task with no `agent_slug`.** The row
   would be created, look healthy in the UI, and never dispatch. Call
   `list_clis` for the slugs this workspace can reach rather than guessing.
2. **A schedule the scheduler can't compute a next fire from** — a bad cron
   expression, a `weekly` with no `days`, and so on.

Both apply to `update_task` too, whenever the patch touches
`type`/`agent_slug`/`command`. An *already* broken task can still be renamed or
disabled — otherwise there'd be no way to turn one off.

### `run_task` and waiting

`run_task` starts the run and returns; an `agent_prompt` run may take up to 30
minutes and nothing in front of this workspace holds a request that long (the
tunnel edge cuts at 30s). Pass `wait_s` (max 120) to be held for a short run,
otherwise come back with `open_task`.

## Task shape

```jsonc
{
  "id": "task-ab12cd34ef56",
  "name": "Daily standup digest",
  "type": "agent_prompt" | "agentic_output" | "terminal",
  "prompt": "…",                     // agent_prompt: sent to the agent
  "command": "…",                    // agentic_output: shell command to run
  "agent_slug": "telegram-sonnet",   // REQUIRED for the two agent types
  "reuse_session": false,            // agent types: resume the same conversation
  "notify_exit_codes": null,         // agentic_output — null/"" = any non-zero is notable
  "cli_type": "terminal",            // terminal type only
  "schedules": [{"kind": "cron", "expr": "0 9 * * *"}],
  "enabled": true,
  "next_fire_at": 1234567890.0,      // epoch seconds, or null (manual-only / disabled)
  "last_run_at": 1234567890.0,
  "last_run_status": "ok" | "error",
  "ap_session_id": "…",              // agent types, when reuse_session is on
  "runs": [{"id": "run-…", "started_at": …, "trigger": "manual"|"cron",
            "status": "ok"|"error", "exit_code": 0, "notified": false,
            "session_id": "…", "output": "…", "error": null}]
}
```

## Three task types

* **`agent_prompt`** — sends `prompt` to the Agents Platform agent named by
  `agent_slug` and records its reply. Needs `agents_platform_base` +
  `agents_platform_token` configured on this app.
* **`agentic_output`** — runs `command` first (no LLM). Only if the exit code
  is *notable* (any non-zero by default, or the explicit list in
  `notify_exit_codes`) does it hand the output to `agent_slug` to interpret.
  This is the type for "run this check and tell me if it breaks", at zero cost
  on the happy path.
* **`terminal`** — ensures a reusable CLI session named `"Task: <name>"` and
  writes `prompt` into it. Needs `config.terminals_api_base`; without it runs
  record a clear `status=error` rather than silently doing nothing. The least
  reliable of the three — prefer `agent_prompt`.

**A task's `command` runs inside the aw-workspace container.** It has `docker`
but no `podman`, and none of an agent runner's tooling.

## Schedules

Combine any number of entries; the task fires whenever the soonest is due.
`once` schedules are dropped after firing. Empty list = manual-only.

```
{"kind": "once",    "at": "2026-08-10T09:00"}
{"kind": "daily",   "time": "09:00"}
{"kind": "weekly",  "days": [0,1,2,3,4], "time": "09:00"}   // 0=Mon..6=Sun
{"kind": "monthly", "day_of_month": 1, "time": "09:00"}
{"kind": "cron",    "expr": "0 9 * * *"}
```

## REST surface

Every path below is relative to `/api/apps/tasks`.

| Method & path | Does |
|---|---|
| `GET /tasks` | List every task (with embedded `runs[]`, newest first). |
| `POST /tasks` | Create. Same validation as `create_task`. |
| `GET /tasks/{id}` | Fetch one task. |
| `PUT /tasks/{id}` | Patch — only send the fields you want to change. |
| `DELETE /tasks/{id}` | Soft-delete. |
| `POST /tasks/{id}/run` | Fire now; returns as soon as the run has started. |
| `GET /agents` | Agents Platform agent slugs (what `list_clis` wraps). |
| `POST /validate-cron` | `{"cron": "…"}` → is it valid, and when does it next fire. |
| `POST /preview-schedules` | `{"schedules": [...]}` → per-entry validity + next fire. |
| `GET /panel` | The clickable Tasks window. **Not `/ui`** — core serves app bundles there and shadows an app's own route. |

```bash
curl -sX POST "$BASE/api/apps/tasks/tasks" -H 'content-type: application/json' -d '{
  "name": "ci-health-watch", "type": "agentic_output",
  "command": "aw-workspace-cli doctor", "agent_slug": "telegram-sonnet",
  "notify_exit_codes": null, "schedules": [], "enabled": true
}'
curl -sX POST "$BASE/api/apps/tasks/tasks/<id>/run"
```

## If the MCP tools aren't there

`contributes.mcp` in the manifest only *declares* the surface. The gateway
finds an upstream by scanning each installed app dir for an `mcp.json`, which
this app writes itself on activation (`tasks_app/mcp/self_register.py`). So:

* No `tasks` tools at all → the app didn't activate, or `mcp.json` wasn't
  written. Check `aw-workspace-cli logs`, and that
  `<installed-app-dir>/mcp.json` exists.
* Tools missing right after an install/update → **restart the mcp-gateway.**
  This app is `tier: inprocess`, so `aw-workspace-cli restart tasks` does not
  apply, and the gateway does not re-scan on its own.
