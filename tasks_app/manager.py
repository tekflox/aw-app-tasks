"""Task execution — ported from the aw monolith's ``src/api/task_manager.py``
(``TaskManager.run_task``) onto the ``ctx`` facades. Three task types are
ported:

* ``terminal``       — writes the prompt into a reusable CLI session, via
                        ``terminal_client.py`` (best-effort HTTP against
                        ``config.terminals_api_base`` — see that module's
                        docstring for the "not yet verified against a live
                        core terminals API" caveat).
* ``agentic_output``  — runs a cheap command; on a notable exit code, hands
                        the output to the configured Agents Platform agent
                        to interpret (same delivery mechanism as
                        agent_prompt, ported 1:1 from the monolith's
                        task_manager.py::_run_agentic_output — see that
                        method's own docstring). Requires agent_slug just
                        like agent_prompt does.
* ``agent_prompt``   — calls an Agents Platform agent with the task's prompt,
                        via ``agents_platform_client.py`` against
                        ``config.agents_platform_base``/``agents_platform_token``
                        (same base-URL + bearer-identity-JWT pattern
                        ``aw-app-agents-platform-runners``'s ``mcp_server.py``
                        already uses to reach ``agents-platform_multitenant``
                        from inside this workspace container — the legacy
                        monolith's ``localhost:10005`` in-process reach is
                        not available here). When ``reuse_session`` is set,
                        the returned Agents Platform run's ``session_id`` is
                        persisted onto the task (``ap_session_id``) and sent
                        back as ``session_id`` on the next run, resuming the
                        same conversation.

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

from . import agentic_output, agents_platform_client, terminal_client
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
        # Strong refs to the detached run bodies started by start_task.
        self._background: set[asyncio.Task] = set()

    def is_firing(self, task_id: str) -> bool:
        return task_id in self._firing

    def _new_run(self, trigger: str) -> dict:
        return {
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

    async def start_task(self, task_id: str, *, trigger: str = "manual") -> dict:
        """Kick a run off and return as soon as it is *started*, with the run
        row already persisted as ``status="running"``.

        This is the path anything time-bounded should use — an HTTP handler,
        or the scheduler tick. Awaiting the whole run instead (``run_task``)
        holds the caller for as long as the work takes, which for an
        ``agent_prompt`` is up to ``agents_platform_client.DEFAULT_TIMEOUT_S``
        (30 minutes). Nothing in front of this workspace keeps a request open
        that long: the tunnel edge cuts at 30s with ``502 workspace
        offline``, the UI reads that as "the task failed", and every retry
        click starts *another* real run behind the dead connection. The
        scheduler had the mirror-image problem — ``_tick`` awaited inline, so
        one slow task starved every other schedule for half an hour.
        """
        task = self.store.get(task_id)
        if not task:
            raise KeyError(task_id)

        run = self._new_run(trigger)
        self._firing.add(task_id)
        self.store.insert_run(task_id, run)
        # Hold a strong reference — asyncio only keeps a weak one, so a
        # fire-and-forget task can otherwise be garbage collected mid-run.
        bg = asyncio.create_task(self._finish_task(task, run))
        self._background.add(bg)
        bg.add_done_callback(self._background.discard)
        return run

    async def run_task(self, task_id: str, *, trigger: str = "manual") -> dict:
        """Run a task to completion and return the finished run. Blocks for
        the full duration — prefer :meth:`start_task` for anything reached
        over HTTP or driven by the scheduler."""
        task = self.store.get(task_id)
        if not task:
            raise KeyError(task_id)

        self._firing.add(task_id)
        try:
            run = self._new_run(trigger)
            await self._dispatch(task, run)
            self.store.record_run(task_id, run)
            await self._maybe_notify(task, run)
            return run
        finally:
            self._firing.discard(task_id)

    async def _finish_task(self, task: dict, run: dict) -> None:
        """Body of a run started by :meth:`start_task` — dispatch, settle the
        row, notify. Runs detached, so it must never raise."""
        task_id = task["id"]
        try:
            await self._dispatch(task, run)
            self.store.finish_run(task_id, run)
            await self._maybe_notify(task, run)
        except Exception:  # noqa: BLE001 - detached: nothing would surface it
            logger.exception("Task %s: recording the run outcome failed", task_id)
        finally:
            self._firing.discard(task_id)

    async def _dispatch(self, task: dict, run: dict) -> None:
        """Run the task body for its type, folding any failure into the run
        dict — a task run must never crash the scheduler."""
        task_id = task["id"]
        task_type = task.get("type") or "terminal"
        try:
            if task_type == "terminal":
                await self._run_terminal(task, run)
            elif task_type == "agentic_output":
                await self._run_agentic_output(task, run)
            elif task_type == "agent_prompt":
                await self._run_agent_prompt(task, run)
            else:
                run["status"] = "error"
                run["error"] = f"unknown task type {task_type!r}"
        except Exception as e:  # noqa: BLE001
            logger.exception("Task %s run failed: %s", task_id, e)
            run["status"] = "error"
            run["error"] = str(e)

    async def _maybe_notify(self, task: dict, run: dict) -> None:
        if self._ctx.has("notifications:send") and (
            run.get("trigger") != "cron" or run["status"] != "ok"
        ):
            await self._notify_run_outcome(task, run)

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
        # cli_type "terminal" means a plain login shell, NOT a command called
        # "terminal" — core would run `bash -lc "cd …; terminal"` and the PTY
        # would die on command-not-found before the prompt ever landed.
        cli_type = (task.get("cli_type") or "terminal").strip()
        cmd = None if cli_type in ("", "terminal") else cli_type
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
        """Run the task's command (cheap, no LLM); only if the exit code is
        *notable* (see notify_exit_codes) hand the command's output + the
        task's prompt to the configured Agents Platform agent to interpret
        and act — this is the point of the type: pay for an agent
        invocation only when something actually changed, not on every tick.

        Ported 1:1 from the monolith's task_manager.py::_run_agentic_output
        — it reuses the exact same delivery mechanism as agent_prompt
        (agents_platform_client.run_agent), so notifications actually reach
        wherever the picked agent_slug delivers to (e.g. a telegram-* agent
        replies into the user's Telegram chat) instead of only the
        workspace SPA's in-app notification tray.
        """
        command = (task.get("command") or "").strip()
        if not command:
            run["status"] = "error"
            run["error"] = "agentic_output task has no command configured"
            return
        slug = (task.get("agent_slug") or "").strip()
        if not slug:
            run["status"] = "error"
            run["error"] = "agentic_output task has no agent_slug configured"
            return

        notify_codes = agentic_output.parse_notify_codes(task.get("notify_exit_codes"))
        loop = asyncio.get_event_loop()
        exit_code, output = await loop.run_in_executor(
            None, agentic_output.run_command, command,
        )
        run["exit_code"] = exit_code

        notify = agentic_output.should_notify(exit_code, notify_codes)
        run["notified"] = notify
        last_notified_exit_code = task.get("last_notified_exit_code")
        if not notify:
            # Recovered (or never notable) — re-arm so the next time it goes
            # notable is treated as a fresh occurrence, not a continuation.
            if last_notified_exit_code is not None:
                self.store.set_last_notified_exit_code(task["id"], None)
            run["status"] = "ok"
            run["output"] = f"exit={exit_code} — no notable difference, agent not invoked"
            return

        if last_notified_exit_code == exit_code:
            # Same notable exit code as the last run that already paid for an
            # agent invocation — the underlying condition hasn't changed, it's
            # just still broken. Notifying again on every tick while it stays
            # stuck is what turned one real failure into 58 paid runs over
            # 27.5h (2026-08-18/20, ~$20). Stay quiet until it changes.
            run["notified"] = False
            run["status"] = "ok"
            run["output"] = (
                f"exit={exit_code} — still notable but unchanged since the last "
                "run that notified the agent; agent not invoked (debounced "
                "until the exit code changes)"
            )
            return

        cfg = self._ctx.config or {}
        base = cfg.get("agents_platform_base")
        token = cfg.get("agents_platform_token")
        if not base or not token:
            run["status"] = "error"
            run["error"] = (
                "agentic_output task needs config.agents_platform_base and "
                "config.agents_platform_token set — see aw-app.json config_schema"
            )
            return

        base_prompt = (task.get("prompt") or "").strip()
        combined_prompt = (
            f"{base_prompt}\n\nSaída do comando (exit code {exit_code}):\n"
            f"{agentic_output.truncate(output)}"
        ).strip()

        reuse = bool(task.get("reuse_session"))
        prior_session = task.get("ap_session_id") if reuse else None
        target_slug = cfg.get("agents_platform_target") or "adhoc"

        try:
            result = await agents_platform_client.run_agent(
                base=base, token=token, slug=slug, prompt=combined_prompt,
                target_slug=target_slug, session_id=prior_session,
            )
        except agents_platform_client.AgentsPlatformError as e:
            run["status"] = "error"
            run["error"] = str(e)
            return

        # The agent was actually invoked (and paid for) for this exit code —
        # debounce it until the condition changes.
        self.store.set_last_notified_exit_code(task["id"], exit_code)

        run["session_id"] = result.get("run_id")
        run["output"] = result.get("text")
        if result.get("is_error"):
            run["status"] = "error"
            run["error"] = result.get("text") or "agents-platform run failed"
        else:
            run["status"] = "ok"

        if reuse and result.get("session_id"):
            try:
                self.store.set_ap_session_id(task["id"], result["session_id"])
            except Exception:
                logger.warning("Task %s: could not persist ap_session_id", task["id"])

    # ------------------------------------------------------------------
    # agent_prompt
    # ------------------------------------------------------------------

    async def _run_agent_prompt(self, task: dict, run: dict) -> None:
        cfg = self._ctx.config or {}
        base = cfg.get("agents_platform_base")
        token = cfg.get("agents_platform_token")
        if not base or not token:
            run["status"] = "error"
            run["error"] = (
                "agent_prompt task type needs config.agents_platform_base and "
                "config.agents_platform_token set — see aw-app.json config_schema "
                "(same values aw-app-agents-platform-runners uses)"
            )
            return

        slug = (task.get("agent_slug") or "").strip()
        if not slug:
            run["status"] = "error"
            run["error"] = "agent_prompt task has no agent_slug configured"
            return
        prompt = (task.get("prompt") or "").strip()
        if not prompt:
            run["status"] = "error"
            run["error"] = "agent_prompt task has no prompt configured"
            return

        reuse = bool(task.get("reuse_session"))
        prior_session = task.get("ap_session_id") if reuse else None
        target_slug = cfg.get("agents_platform_target") or "adhoc"

        try:
            result = await agents_platform_client.run_agent(
                base=base, token=token, slug=slug, prompt=prompt,
                target_slug=target_slug, session_id=prior_session,
            )
        except agents_platform_client.AgentsPlatformError as e:
            run["status"] = "error"
            run["error"] = str(e)
            return

        run["session_id"] = result.get("run_id")
        run["output"] = result.get("text")
        if result.get("is_error"):
            run["status"] = "error"
            run["error"] = result.get("text") or "agents-platform run failed"
        else:
            run["status"] = "ok"

        if reuse and result.get("session_id"):
            try:
                self.store.set_ap_session_id(task["id"], result["session_id"])
            except Exception:
                logger.warning("Task %s: could not persist ap_session_id", task["id"])

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
