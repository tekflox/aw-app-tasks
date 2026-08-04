"""Task execution — ported from the aw monolith's ``src/api/task_manager.py``
(``TaskManager.run_task``) onto the ``ctx`` facades. Two task types are
ported:

* ``terminal``       — writes the prompt into a reusable CLI session, via
                        ``terminal_client.py`` (best-effort HTTP against
                        ``config.terminals_api_base`` — see that module's
                        docstring for the "not yet verified against a live
                        core terminals API" caveat).
* ``agentic_output``  — runs a cheap command; on a notable exit code, fires
                        a workspace notification (``ctx.notify``) instead of
                        the monolith's Telegram-bot-agent interpretation
                        (see ``agentic_output.py``'s docstring for why).

**Not ported**: ``agent_prompt`` (call an Agents Platform agent with a
prompt) — the roadmap's dependency list for Scheduled Tasks
(``watchdog ✅, db ✅, terminals API``) does not include an Agents Platform
app, so there is nothing to port this onto yet. A task created with
``type=agent_prompt`` runs and records a clear ``status=error`` run
explaining that, rather than silently doing nothing or crashing the
scheduler — a human should decide whether/how to wire this up once an
Agents-Platform-equivalent app exists.

Session reuse / agent-conversation resume (the monolith's
``ensure_task_session``/``resolve_session_for_task``/agent-session-id
capture-by-polling machinery) is deliberately not reproduced — this app has
no visibility into the core terminal manager's process/session internals,
only the coarse ensure/write HTTP surface described above. `terminal` tasks
here reuse a session purely by id (``task.session_id``), asking the
terminals API whether it's still alive.
"""
from __future__ import annotations

import asyncio
import logging
import time

from . import agentic_output, terminal_client
from .store import TaskStore

logger = logging.getLogger("tasks_app.manager")


def _now() -> float:
    return time.time()


class TaskManager:
    def __init__(self, ctx, store: TaskStore):
        self._ctx = ctx
        self.store = store
        # Guards against a scheduler tick re-firing a task that is still
        # mid-run from a previous tick (mirrors the monolith's
        # TaskScheduler._firing set).
        self._firing: set[str] = set()

    def is_firing(self, task_id: str) -> bool:
        return task_id in self._firing

    async def run_task(self, task_id: str, *, trigger: str = "manual") -> dict:
        task = self.store.get(task_id)
        if not task:
            raise KeyError(task_id)

        self._firing.add(task_id)
        try:
            run: dict = {
                "id": self.store.next_run_id(),
                "started_at": _now(),
                "trigger": trigger,
                "status": "running",
                "session_id": None,
                "exit_code": None,
                "notified": None,
                "output": None,
                "error": None,
            }
            task_type = task.get("type") or "terminal"
            try:
                if task_type == "terminal":
                    await self._run_terminal(task, run)
                elif task_type == "agentic_output":
                    await self._run_agentic_output(task, run)
                else:
                    run["status"] = "error"
                    run["error"] = (
                        f"task type {task_type!r} is not supported by this decoupled app "
                        "yet (no Agents Platform dependency declared) — see manager.py"
                    )
            except Exception as e:  # noqa: BLE001 - task run must never crash the scheduler
                logger.exception("Task %s run failed: %s", task_id, e)
                run["status"] = "error"
                run["error"] = str(e)

            self.store.record_run(task_id, run)
            if self._ctx.has("notifications:send") and (trigger != "cron" or run["status"] != "ok"):
                await self._notify_run_outcome(task, run)
            return run
        finally:
            self._firing.discard(task_id)

    # ------------------------------------------------------------------
    # terminal
    # ------------------------------------------------------------------

    async def _run_terminal(self, task: dict, run: dict) -> None:
        base = (self._ctx.config or {}).get("terminals_api_base")
        if not base:
            run["status"] = "error"
            run["error"] = (
                "terminal task type needs config.terminals_api_base set to the "
                "workspace's terminals API — see aw-app.json config_schema"
            )
            return

        prompt = (task.get("prompt") or "").rstrip()
        session_name = f"Task: {task['name']}"
        cmd = task.get("cli_type") or "terminal"
        sid = await terminal_client.ensure_session(
            base, name=session_name, command=cmd, session_id=task.get("session_id"),
        )
        if sid != task.get("session_id"):
            self.store.set_session_id(task["id"], sid)
        run["session_id"] = sid

        if prompt:
            await terminal_client.write_prompt(base, sid, prompt)
        run["status"] = "ok"

    # ------------------------------------------------------------------
    # agentic_output
    # ------------------------------------------------------------------

    async def _run_agentic_output(self, task: dict, run: dict) -> None:
        command = (task.get("command") or "").strip()
        if not command:
            run["status"] = "error"
            run["error"] = "agentic_output task has no command configured"
            return

        notify_codes = agentic_output.parse_notify_codes(task.get("notify_exit_codes"))
        loop = asyncio.get_event_loop()
        exit_code, output = await loop.run_in_executor(
            None, agentic_output.run_command, command,
        )
        run["exit_code"] = exit_code
        run["output"] = agentic_output.truncate(output)
        run["status"] = "ok"

        notify = agentic_output.should_notify(exit_code, notify_codes)
        run["notified"] = notify
        if notify and self._ctx.has("notifications:send"):
            title, message = agentic_output.build_notification(
                command=command, exit_code=exit_code, output=output,
                task_name=task.get("name"),
            )
            await self._safe_notify(message, level=("error" if exit_code else "success"), title=title)

    # ------------------------------------------------------------------
    # notifications
    # ------------------------------------------------------------------

    async def _notify_run_outcome(self, task: dict, run: dict) -> None:
        name = task.get("name") or task["id"]
        if run["status"] == "ok":
            message = f"{name} ran successfully ({run['trigger']})"
            level = "success"
        else:
            message = f"{name} failed: {run.get('error') or 'unknown error'}"
            level = "error"
        await self._safe_notify(message, level=level, title=f"Task {name}")

    async def _safe_notify(self, message: str, *, level: str, title: str) -> None:
        try:
            result = self._ctx.notify(message, level=level, title=title)
            if result is not None and hasattr(result, "__await__"):
                await result
        except Exception:
            logger.exception("notify failed")
