"""MCP server for Scheduled Tasks, exposed over Streamable HTTP (POST /mcp).

Ported from agentic-workspace's ``src/mcp/tasks.py``, which was a **stdio**
MCP server that round-tripped HTTP to the monolith's ``awserv``. This app is
Tier-1 (in-process), and the aw-mcp-gateway that aggregates MCP tools runs in
a SIBLING container — it cannot spawn a process inside aw-workspace — so the
same tool surface is re-exposed here over Streamable HTTP (JSON-RPC 2.0, the
wire protocol the gateway's ``HttpUpstream`` speaks). Same shape as
``aw-app-whiteboard``'s ``whiteboard_app/mcp/http_handler.py``.

Being in-process, the handlers call ``TaskStore``/``TaskManager`` **directly**
instead of curling this app's own REST routes. The validation both surfaces
must agree on therefore lives in ``tasks_app/validation.py``, not in
``routes.py``.

Seven of the monolith's eight tools map onto machinery that already exists
here. The eighth, ``open_task``, does not:

    monolith                            here
    list_tasks / get_task / create_task / update_task / delete_task /
    run_task / list_clis                 → TaskStore + TaskManager, 1:1
    open_task = "the task's bound        → "the task's last run(s)":
      terminal session + its                status, exit code, output, error
      scrollback"                           straight off app__tasks__runs

The old ``open_task`` was scrollback off a `terminal`-type task's reusable
CLI session. That type has never actually worked in this workspace (unset
``terminals_api_base``, no auth, a write contract that returned ok while
doing nothing), and what tasks really run today is ``agent_prompt`` /
``agentic_output`` — whose output this app already persists per run. So the
name is kept and the meaning is re-pointed at the question a caller was
really asking: *what happened last time this ran?* That is answerable, and
answerable for every task type, which the scrollback version never was.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from .. import agents_platform_client, scheduling, validation

# A `run_task` caller can ask to be held while the run finishes, but not for
# the 30 minutes an agent_prompt run is allowed to take — nothing in front of
# this workspace keeps a request open that long (the tunnel edge cuts at 30s
# and the gateway has its own ceiling). Past this, come back via `open_task`.
MAX_WAIT_S = 120
_POLL_INTERVAL_S = 1.0

SCHEDULE_DOC = (
    "Schedule entries, any mix: "
    '{"kind":"once","at":"YYYY-MM-DDTHH:MM"} | '
    '{"kind":"daily","time":"HH:MM"} | '
    '{"kind":"weekly","days":[0..6],"time":"HH:MM"} (0=Mon) | '
    '{"kind":"monthly","day_of_month":1..31,"time":"HH:MM"} | '
    '{"kind":"cron","expr":"<5-field cron>"}. '
    "Empty list = manual-only (fires only via run_task)."
)

_TYPE_DOC = (
    "Task type. 'agent_prompt' sends `prompt` to the Agents Platform agent "
    "named by `agent_slug`. 'agentic_output' runs `command` first and only "
    "pays for that agent when the exit code is notable. 'terminal' writes "
    "`prompt` into a reusable CLI session and needs this app's "
    "terminals_api_base config — it is the least used of the three. Note "
    "that a task's `command` runs inside the aw-workspace container, which "
    "has docker but no podman."
)

_SLUG_DOC = (
    "Agents Platform agent slug. REQUIRED for 'agent_prompt' and "
    "'agentic_output' — a task of either type without one is created but "
    "never dispatches. See list_clis."
)

TOOLS_SCHEMA: list[dict] = [
    {
        "name": "list_tasks",
        "description": (
            "List every scheduled task in this workspace with its schedule "
            "count, enabled flag, next fire time and last run outcome. "
            "Summaries only — use get_task for one task's full detail."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_task",
        "description": "One task in full, including its recent runs[].",
        "inputSchema": {
            "type": "object",
            "properties": {"task_id": {"type": "string", "description": "Task id (task-…)."}},
            "required": ["task_id"],
        },
    },
    {
        "name": "create_task",
        "description": (
            "Create a scheduled task. Validated before anything is written: "
            "an 'agent_prompt'/'agentic_output' task without agent_slug is "
            "REFUSED rather than created dead, and every schedule entry must "
            "be one the scheduler can compute a next fire from."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Task name. Also names the bound session for 'terminal' tasks."},
                "type": {"type": "string", "enum": list(validation.KNOWN_TYPES), "description": _TYPE_DOC},
                "prompt": {"type": "string", "description": "Prompt sent to the agent ('agent_prompt'), prepended to the command output ('agentic_output'), or typed into the session ('terminal')."},
                "command": {"type": "string", "description": "Shell command — required for 'agentic_output'. Runs in the aw-workspace container."},
                "agent_slug": {"type": "string", "description": _SLUG_DOC},
                "notify_exit_codes": {"type": "string", "description": "'agentic_output' only. null/'' /'nonzero' = any non-zero exit is notable; or an explicit list like '1,2,127'."},
                "cli_type": {"type": "string", "description": "'terminal' only — the CLI the session runs. 'terminal' means a plain login shell."},
                "schedules": {"type": "array", "items": {"type": "object"}, "description": SCHEDULE_DOC},
                "enabled": {"type": "boolean", "description": "Default true. A disabled task never fires on schedule but can still be run manually."},
                "reuse_session": {"type": "boolean", "description": "Agent types: resume the same Agents Platform conversation each run instead of starting fresh."},
            },
            "required": ["name"],
        },
    },
    {
        "name": "update_task",
        "description": (
            "Patch a task — send only the fields you want to change. A patch "
            "that touches type/agent_slug/command is re-validated against the "
            "merged result, so an edit cannot leave a task that dispatches "
            "nowhere."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task id (task-…)."},
                "name": {"type": "string"},
                "type": {"type": "string", "enum": list(validation.KNOWN_TYPES), "description": _TYPE_DOC},
                "prompt": {"type": "string"},
                "command": {"type": "string"},
                "agent_slug": {"type": "string", "description": _SLUG_DOC},
                "notify_exit_codes": {"type": "string"},
                "cli_type": {"type": "string"},
                "schedules": {"type": "array", "items": {"type": "object"}, "description": SCHEDULE_DOC},
                "enabled": {"type": "boolean"},
                "reuse_session": {"type": "boolean"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "delete_task",
        "description": "Delete a task (soft — hidden and disabled, so nothing it already ran is lost).",
        "inputSchema": {
            "type": "object",
            "properties": {"task_id": {"type": "string", "description": "Task id (task-…)."}},
            "required": ["task_id"],
        },
    },
    {
        "name": "run_task",
        "description": (
            "Fire a task now (trigger=manual), regardless of its schedule or "
            "enabled flag. Returns as soon as the run is started; pass "
            f"wait_s (max {MAX_WAIT_S}) to be held until it finishes, or call "
            "open_task afterwards to read the outcome."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task id (task-…)."},
                "wait_s": {"type": "integer", "description": f"Seconds to wait for the run to finish. Default 0 (return immediately), max {MAX_WAIT_S}."},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "open_task",
        "description": (
            "What happened the last time this task ran: status, exit code, "
            "the agent's reply or the command's output, and any error — plus "
            "the Agents Platform run id for an agent-backed task, which you "
            "can hand to the agents-platform tools for the full transcript. "
            "This is the 'open the task and look' tool."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task id (task-…)."},
                "limit": {"type": "integer", "description": "How many recent runs to return, newest first. Default 1."},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "list_clis",
        "description": (
            "What a new task can be pointed at: the Agents Platform agent "
            "slugs reachable from this workspace (for agent_slug) and the "
            "cli_type values a 'terminal' task accepts. Call this before "
            "create_task rather than guessing a slug."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
]


_NEEDS_TASK_ID = ("get_task", "update_task", "delete_task", "run_task", "open_task")


def _ok(req_id, text: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id,
            "result": {"content": [{"type": "text", "text": text}], "isError": False}}


def _err(req_id, text: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id,
            "result": {"content": [{"type": "text", "text": text}], "isError": True}}


def _json(obj: Any) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False, default=str)


def _summarize_task(t: dict) -> dict:
    """The fields a caller usually wants — same intent as the monolith's
    ``_summarize_task``: keep a 40-task list readable."""
    runs = t.get("runs") or []
    return {
        "id": t.get("id"),
        "name": t.get("name"),
        "type": t.get("type"),
        "enabled": t.get("enabled"),
        "agent_slug": t.get("agent_slug"),
        "schedules": t.get("schedules"),
        "next_fire_at": _iso(t.get("next_fire_at")),
        "last_run_at": _iso(t.get("last_run_at")),
        "last_run_status": t.get("last_run_status"),
        "run_count": len(runs),
    }


def _iso(ts) -> str | None:
    """Epoch seconds are unreadable to an agent deciding whether a schedule
    is sane; hand back both."""
    if not ts:
        return None
    return f"{time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(ts))} ({ts})"


def _run_view(run: dict) -> dict:
    return {
        "run_id": run.get("id"),
        "started_at": _iso(run.get("started_at")),
        "trigger": run.get("trigger"),
        "status": run.get("status"),
        "exit_code": run.get("exit_code"),
        "notified": run.get("notified"),
        # For agent-backed types this is the Agents Platform run id; for a
        # 'terminal' task it is the CLI session id.
        "session_id": run.get("session_id"),
        "output": run.get("output"),
        "error": run.get("error"),
    }


async def _await_run(store, task_id: str, run_id: str, wait_s: int) -> dict | None:
    """Poll the run row until it leaves ``running`` or the budget runs out.

    Polling the store rather than awaiting the manager's background task on
    purpose: ``start_task`` deliberately detaches the run body so a slow task
    can't starve the scheduler, and the row is written before it returns.
    """
    deadline = time.monotonic() + wait_s
    latest = None
    while True:
        for r in store.runs_for(task_id, limit=10):
            if r.get("id") == run_id:
                latest = r
                break
        if latest is None or latest.get("status") != "running":
            return latest
        if time.monotonic() >= deadline:
            return latest
        await asyncio.sleep(_POLL_INTERVAL_S)


async def handle_request(request: dict, *, ctx, store, manager) -> dict | None:
    method = request.get("method", "")
    req_id = request.get("id")

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "aw-app-tasks", "version": "1.0.0"},
            },
        }
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS_SCHEMA}}
    if method != "tools/call":
        return {"jsonrpc": "2.0", "id": req_id,
                "error": {"code": -32601, "message": f"Unknown method: {method}"}}

    name = request.get("params", {}).get("name", "")
    args = request.get("params", {}).get("arguments", {}) or {}

    # Named explicitly rather than "everything except the list tools" — with
    # a blocklist, a typo'd tool name fell in here and came back as
    # "task_id is required", which reads as a bad call rather than a bad name.
    task_id = (args.get("task_id") or "").strip()
    if name in _NEEDS_TASK_ID and not task_id:
        return _err(req_id, "task_id is required")

    try:
        if name == "list_tasks":
            tasks = store.list()
            return _ok(req_id, _json({
                "count": len(tasks),
                "tasks": [_summarize_task(t) for t in tasks],
            }))

        if name == "get_task":
            t = store.get(task_id)
            if not t:
                return _err(req_id, f"task {task_id!r} not found")
            t = dict(t)
            t["runs"] = [_run_view(r) for r in (t.get("runs") or [])]
            t["next_fire_at"] = _iso(t.get("next_fire_at"))
            t["last_run_at"] = _iso(t.get("last_run_at"))
            return _ok(req_id, _json(t))

        if name == "create_task":
            kwargs, err = validation.normalize_create(args)
            if err:
                return _err(req_id, err)
            task = store.create(**kwargs)
            return _ok(req_id, _json({"created": _summarize_task(task)}))

        if name == "update_task":
            existing = store.get(task_id)
            if not existing:
                return _err(req_id, f"task {task_id!r} not found")
            patch = {k: v for k, v in args.items() if k != "task_id"}
            if not patch:
                return _err(req_id, "nothing to update — pass at least one field besides task_id")
            err = validation.validate_patch(existing, patch)
            if err:
                return _err(req_id, err)
            updated = store.update(task_id, patch)
            return _ok(req_id, _json({"updated": _summarize_task(updated)}))

        if name == "delete_task":
            if not store.delete(task_id):
                return _err(req_id, f"task {task_id!r} not found")
            return _ok(req_id, _json({"deleted": task_id}))

        if name == "run_task":
            try:
                run = await manager.start_task(task_id, trigger="manual")
            except KeyError:
                return _err(req_id, f"task {task_id!r} not found")
            wait_s = min(max(int(args.get("wait_s") or 0), 0), MAX_WAIT_S)
            if wait_s:
                settled = await _await_run(store, task_id, run["id"], wait_s)
                if settled is not None:
                    run = settled
            still_running = run.get("status") == "running"
            return _ok(req_id, _json({
                "started": True,
                "still_running": still_running,
                "run": _run_view(run),
                "note": (
                    "The run is still going — call open_task to read the outcome."
                    if still_running else "Run finished."
                ),
            }))

        if name == "open_task":
            t = store.get(task_id)
            if not t:
                return _err(req_id, f"task {task_id!r} not found")
            limit = max(int(args.get("limit") or 1), 1)
            runs = store.runs_for(task_id, limit=limit)
            if not runs:
                return _ok(req_id, _json({
                    "task": _summarize_task(t),
                    "runs": [],
                    "note": "This task has never run. run_task fires it now.",
                }))
            return _ok(req_id, _json({
                "task": _summarize_task(t),
                "runs": [_run_view(r) for r in runs],
            }))

        if name == "list_clis":
            cfg = ctx.config or {}
            base, token = cfg.get("agents_platform_base"), cfg.get("agents_platform_token")
            agents: list[dict] = []
            note = None
            if base and token:
                agents = await agents_platform_client.list_agents(base=base, token=token)
                if not agents:
                    note = ("Agents Platform is configured but returned no agents — "
                            "it may be unreachable or the token expired.")
            else:
                note = ("agents_platform_base/agents_platform_token are not set on "
                        "this app, so agent slugs cannot be listed and "
                        "'agent_prompt'/'agentic_output' tasks cannot run. "
                        "Configure them on the Apps card.")
            out: dict = {
                "agent_slugs": agents,
                "cli_types": [
                    {"cli_type": "terminal", "note": "a plain login shell (the default)"},
                    {"cli_type": "<any command on PATH>", "note": "e.g. 'claude', 'codex' — run as the session's command"},
                ],
                "schedule_kinds": list(scheduling.SCHEDULE_KINDS),
            }
            if note:
                out["note"] = note
            return _ok(req_id, _json(out))

    except Exception as exc:  # noqa: BLE001 — an MCP error beats a 500
        return _err(req_id, f"{type(exc).__name__}: {exc}")

    return _err(req_id, f"Unknown tool: {name}")
