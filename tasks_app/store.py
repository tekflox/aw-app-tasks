"""Task + run storage, ported from the aw monolith's
``src/api/task_manager.py`` (``TaskStore``) onto the ``ctx.db``
(``db:own-tables``) facade instead of the monolith's ``.tmp/tasks.json``
file. Two own-tables:

* ``app__tasks__tasks``  — one row per task (mirrors the monolith's task dict,
  including the Agents-Platform fields ``agent_slug``/``reuse_session``/
  ``ap_session_id`` for ``type=agent_prompt`` — see ``manager.py``'s module
  docstring. ``agent_session_id`` (the monolith's screen-session-linked
  agent conversation id) is NOT ported — this app has no visibility into
  core terminal-session internals; ``ap_session_id`` (the Agents Platform
  run/session id, used to resume via ``session_id`` on the next
  ``/api/agents/<slug>/run`` call) is the equivalent this app actually
  uses).
* ``app__tasks__runs``   — one row per run, newest first, FK'd to
  ``task_id`` (the monolith embedded a capped ``runs[]`` list on the task
  JSON; a real relational table is the more natural ``db:own-tables`` shape
  and is what proves "rows in Postgres" for this app rather than one big
  JSON blob column).

Task ids are opaque (``task-<12 hex>``) instead of the monolith's in-memory
incrementing counter — that counter lived only in a ``threading.Lock``-guarded
process global with no durable state of its own; a uuid avoids needing a
counter row and any correctness assumptions about single-process ownership.
"""
from __future__ import annotations

import json
import time
import uuid

from . import scheduling

_TASKS_TABLE = "app__tasks__tasks"
_RUNS_TABLE = "app__tasks__runs"
MAX_RUNS_PER_TASK = 50

_TASKS_DDL = """
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'terminal',
    cli_type TEXT NOT NULL DEFAULT 'terminal',
    prompt TEXT NOT NULL DEFAULT '',
    command TEXT,
    notify_exit_codes TEXT,
    schedules TEXT NOT NULL DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT true,
    session_id TEXT,
    hidden BOOLEAN NOT NULL DEFAULT false,
    created_at DOUBLE PRECISION,
    next_fire_at DOUBLE PRECISION,
    last_run_at DOUBLE PRECISION,
    last_run_status TEXT,
    agent_slug TEXT,
    reuse_session BOOLEAN NOT NULL DEFAULT false,
    ap_session_id TEXT
"""

# Columns added after the table's first release — CREATE TABLE IF NOT
# EXISTS is a no-op against an already-existing table, so any workspace
# that installed this app before these fields existed needs an explicit
# migration. ADD COLUMN IF NOT EXISTS is idempotent, safe to re-run every
# process start.
_TASKS_MIGRATIONS = (
    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS agent_slug TEXT",
    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS reuse_session BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS ap_session_id TEXT",
)

_RUNS_DDL = """
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    started_at DOUBLE PRECISION,
    trigger TEXT,
    status TEXT,
    session_id TEXT,
    exit_code INTEGER,
    notified BOOLEAN,
    output TEXT,
    error TEXT
"""

# The editable subset PUT /tasks/{id} accepts.
_PATCHABLE_FIELDS = (
    "name", "type", "cli_type", "prompt", "command", "notify_exit_codes",
    "schedules", "enabled", "agent_slug", "reuse_session",
)


def _now() -> float:
    return time.time()


class TaskStore:
    """``ctx.db``-backed task + run store."""

    def __init__(self, ctx):
        self._ctx = ctx
        ctx.db.create(_TASKS_TABLE, _TASKS_DDL)
        ctx.db.create(_RUNS_TABLE, _RUNS_DDL)
        for stmt in _TASKS_MIGRATIONS:
            self._ctx.db.execute(_TASKS_TABLE, stmt)

    # ------------------------------------------------------------------
    # Task CRUD
    # ------------------------------------------------------------------

    def list(self) -> list[dict]:
        rows = self._ctx.db.execute(
            _TASKS_TABLE,
            "SELECT * FROM {table} WHERE hidden = :hidden ORDER BY created_at DESC",
            {"hidden": False},
        )
        return [self._to_dict(r, with_runs=True) for r in rows]

    def get(self, task_id: str) -> dict | None:
        rows = self._ctx.db.execute(
            _TASKS_TABLE, "SELECT * FROM {table} WHERE id = :id", {"id": task_id})
        if not rows:
            return None
        return self._to_dict(rows[0], with_runs=True)

    def create(self, *, name: str, type: str = "terminal", cli_type: str = "terminal",
              prompt: str = "", command: str | None = None,
              notify_exit_codes: str | None = None,
              schedules: list[dict] | None = None, enabled: bool = True,
              agent_slug: str | None = None, reuse_session: bool = False) -> dict:
        task_id = f"task-{uuid.uuid4().hex[:12]}"
        now = _now()
        schedules = list(schedules or [])
        next_fire_at = scheduling.compute_next_fire({"schedules": schedules}, now) if enabled else None
        self._ctx.db.execute(
            _TASKS_TABLE,
            """
            INSERT INTO {table}
                (id, name, type, cli_type, prompt, command, notify_exit_codes,
                 schedules, enabled, session_id, hidden, created_at,
                 next_fire_at, last_run_at, last_run_status,
                 agent_slug, reuse_session, ap_session_id)
            VALUES
                (:id, :name, :type, :cli_type, :prompt, :command, :notify_exit_codes,
                 :schedules, :enabled, NULL, :hidden, :created_at,
                 :next_fire_at, NULL, NULL,
                 :agent_slug, :reuse_session, NULL)
            """,
            {
                "id": task_id, "name": name, "type": type, "cli_type": cli_type,
                "prompt": prompt, "command": command, "notify_exit_codes": notify_exit_codes,
                "schedules": json.dumps(schedules), "enabled": bool(enabled),
                "hidden": False, "created_at": now, "next_fire_at": next_fire_at,
                "agent_slug": agent_slug, "reuse_session": bool(reuse_session),
            },
        )
        return self.get(task_id)

    def update(self, task_id: str, patch: dict) -> dict | None:
        existing = self.get(task_id)
        if not existing:
            return None
        fields = {k: v for k, v in patch.items() if k in _PATCHABLE_FIELDS}
        if not fields:
            return existing
        merged = {**existing, **fields}
        if "schedules" in fields or "enabled" in fields:
            merged["next_fire_at"] = (
                scheduling.compute_next_fire(merged) if merged.get("enabled") else None
            )
        set_clauses = ", ".join(f"{k} = :{k}" for k in (*fields.keys(), "next_fire_at"))
        params = {k: fields[k] for k in fields}
        params["schedules"] = json.dumps(merged["schedules"])
        params["next_fire_at"] = merged["next_fire_at"]
        params["id"] = task_id
        self._ctx.db.execute(
            _TASKS_TABLE, f"UPDATE {{table}} SET {set_clauses} WHERE id = :id", params)
        return self.get(task_id)

    def delete(self, task_id: str) -> bool:
        existing = self.get(task_id)
        if not existing:
            return False
        self._ctx.db.execute(
            _TASKS_TABLE,
            "UPDATE {table} SET hidden = :hidden, enabled = :enabled, next_fire_at = NULL WHERE id = :id",
            {"hidden": True, "enabled": False, "id": task_id},
        )
        return True

    def set_session_id(self, task_id: str, session_id: str | None) -> None:
        self._ctx.db.execute(
            _TASKS_TABLE, "UPDATE {table} SET session_id = :sid WHERE id = :id",
            {"sid": session_id, "id": task_id},
        )

    def set_ap_session_id(self, task_id: str, ap_session_id: str | None) -> None:
        self._ctx.db.execute(
            _TASKS_TABLE, "UPDATE {table} SET ap_session_id = :sid WHERE id = :id",
            {"sid": ap_session_id, "id": task_id},
        )

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------

    def next_run_id(self) -> str:
        return f"run-{int(_now())}-{uuid.uuid4().hex[:8]}"

    def runs_for(self, task_id: str, limit: int = MAX_RUNS_PER_TASK) -> list[dict]:
        rows = self._ctx.db.execute(
            _RUNS_TABLE,
            "SELECT * FROM {table} WHERE task_id = :task_id ORDER BY started_at DESC LIMIT :limit",
            {"task_id": task_id, "limit": limit},
        )
        return [self._run_to_dict(r) for r in rows]

    def insert_run(self, task_id: str, run: dict) -> None:
        """Persist a run row at the moment it starts, while it is still
        ``status="running"``, and show that on the task itself.

        The manager writes the row up-front (rather than only once the work
        is done) so a long run is visible in the UI *while* it runs — the
        list already renders ``last_run_status == "running"`` as its own
        badge. Without this a slow run left the UI looking untouched, which
        reads as "the run never started" and invites a second click.
        """
        self._ctx.db.execute(
            _RUNS_TABLE,
            """
            INSERT INTO {table}
                (id, task_id, started_at, trigger, status, session_id,
                 exit_code, notified, output, error)
            VALUES
                (:id, :task_id, :started_at, :trigger, :status, :session_id,
                 :exit_code, :notified, :output, :error)
            """,
            {
                "id": run["id"], "task_id": task_id, "started_at": run.get("started_at"),
                "trigger": run.get("trigger"), "status": run.get("status"),
                "session_id": run.get("session_id"), "exit_code": run.get("exit_code"),
                "notified": run.get("notified"), "output": run.get("output"),
                "error": run.get("error"),
            },
        )
        self._ctx.db.execute(
            _TASKS_TABLE,
            "UPDATE {table} SET last_run_at = :last_run_at, "
            "last_run_status = :last_run_status WHERE id = :id",
            {
                "last_run_at": run.get("started_at"),
                "last_run_status": run.get("status"),
                "id": task_id,
            },
        )

    def finish_run(self, task_id: str, run: dict) -> dict | None:
        """Write a started run's final outcome back onto its row, bump the
        task's last_run_*, prune fired `once` schedules and recompute
        next_fire_at. Returns the updated task dict, or None if the task no
        longer exists. Pairs with :meth:`insert_run`."""
        task = self.get(task_id)
        if not task:
            return None

        self._ctx.db.execute(
            _RUNS_TABLE,
            """
            UPDATE {table} SET
                status = :status, session_id = :session_id, exit_code = :exit_code,
                notified = :notified, output = :output, error = :error
            WHERE id = :id
            """,
            {
                "id": run["id"], "status": run.get("status"),
                "session_id": run.get("session_id"), "exit_code": run.get("exit_code"),
                "notified": run.get("notified"), "output": run.get("output"),
                "error": run.get("error"),
            },
        )
        return self._settle_task(task, run)

    def record_run(self, task_id: str, run: dict) -> dict | None:
        """Insert an already-finished run row and settle the task in one
        step — the one-shot path, for a run that was never announced as
        ``running`` first. Returns the updated task dict, or None if the
        task no longer exists."""
        task = self.get(task_id)
        if not task:
            return None
        self.insert_run(task_id, run)
        return self._settle_task(task, run)

    def _settle_task(self, task: dict, run: dict) -> dict | None:
        """Bump last_run_*, prune fired `once` schedules, recompute
        next_fire_at — the task-side half of recording a finished run."""
        task_id = task["id"]

        # Prune any `once` schedule that has already fired, recompute next_fire.
        now = _now()
        kept = []
        for s in scheduling.normalize_schedules(task):
            if s.get("kind") == "once":
                try:
                    from datetime import datetime
                    if datetime.fromisoformat(s.get("at", "")).timestamp() > now:
                        kept.append(s)
                except Exception:
                    pass  # unparseable — drop it
            else:
                kept.append(s)

        next_fire_at = scheduling.compute_next_fire({"schedules": kept}, now) if task.get("enabled") else None
        self._ctx.db.execute(
            _TASKS_TABLE,
            "UPDATE {table} SET schedules = :schedules, next_fire_at = :next_fire_at, "
            "last_run_at = :last_run_at, last_run_status = :last_run_status WHERE id = :id",
            {
                "schedules": json.dumps(kept), "next_fire_at": next_fire_at,
                "last_run_at": run.get("started_at"), "last_run_status": run.get("status"),
                "id": task_id,
            },
        )
        return self.get(task_id)

    # ------------------------------------------------------------------
    # Row <-> dict
    # ------------------------------------------------------------------

    def _to_dict(self, row, with_runs: bool = False) -> dict:
        m = row._mapping
        d = {
            "id": m["id"], "name": m["name"], "type": m["type"], "cli_type": m["cli_type"],
            "prompt": m["prompt"], "command": m["command"], "notify_exit_codes": m["notify_exit_codes"],
            "schedules": json.loads(m["schedules"] or "[]"), "enabled": bool(m["enabled"]),
            "session_id": m["session_id"], "created_at": m["created_at"],
            "next_fire_at": m["next_fire_at"], "last_run_at": m["last_run_at"],
            "last_run_status": m["last_run_status"],
            "agent_slug": m["agent_slug"], "reuse_session": bool(m["reuse_session"]),
            "ap_session_id": m["ap_session_id"],
        }
        if with_runs:
            d["runs"] = self.runs_for(m["id"])
        return d

    @staticmethod
    def _run_to_dict(row) -> dict:
        m = row._mapping
        return {
            "id": m["id"], "task_id": m["task_id"], "started_at": m["started_at"],
            "trigger": m["trigger"], "status": m["status"], "session_id": m["session_id"],
            "exit_code": m["exit_code"], "notified": m["notified"],
            "output": m["output"], "error": m["error"],
        }
