"""Entrypoint referenced by aw-app.json's runtime.entrypoint
("tasks_app.plugin:TasksAppPlugin").

Ports the monolith's ``/api/tasks/*`` + the cron-tick loop
(``src/api/task_scheduler.py``) onto the F4 ``ctx`` facades:

* ``ctx.routes`` (``routes:register``) — HTTP sub-app mounted at
  ``/api/apps/tasks`` by the runtime.
* ``ctx.db`` (``db:own-tables``) — tasks + runs live in this app's own
  Postgres tables instead of the monolith's ``.tmp/tasks.json``.
* ``ctx.watchdog`` (``watchdog:tasks``) — replaces the monolith's
  free-running ``asyncio`` while-loop (``TaskScheduler.run``) with a
  periodic tick registered through the gated facade (same pattern
  ``aw-app-git`` uses for its uncommitted-changes watchdog).
* ``ctx.notify`` (``notifications:send``) — run-outcome + agentic_output
  notifications.
"""
from __future__ import annotations

import logging
import os
import time

from . import routes as routes_mod
from .manager import TaskManager
from .mcp import self_register as mcp_self_register
from .store import TaskStore

log = logging.getLogger("aw_apps.tasks")

DEFAULT_SCHEDULER_INTERVAL_S = 5.0
MIN_SCHEDULER_INTERVAL_S = 1.0


def _scheduler_interval_s(ctx) -> float:
    raw = (ctx.config or {}).get("scheduler_interval_s")
    try:
        interval = float(raw) if raw else DEFAULT_SCHEDULER_INTERVAL_S
    except (TypeError, ValueError):
        interval = DEFAULT_SCHEDULER_INTERVAL_S
    return max(interval, MIN_SCHEDULER_INTERVAL_S)


class TasksAppPlugin:
    async def activate(self, ctx) -> None:
        self.ctx = ctx
        self.store = TaskStore(ctx)
        self.manager = TaskManager(ctx, self.store)

        ctx.routes.register(routes_mod.build_routes(ctx, self.store, self.manager))

        # Make the MCP endpoint discoverable by aw-mcp-gateway's app-scan.
        # contributes.mcp in the manifest only *declares* the surface — this
        # is what actually serves it. See mcp/self_register.py.
        mcp_self_register.register_self(
            ctx.package_dir, int(os.environ.get("AW_PORT", "9030")),
        )

        if ctx.has("watchdog:tasks"):
            ctx.watchdog.register(
                "scheduler", self._tick, lambda: _scheduler_interval_s(ctx),
                run_immediately=False,
            )
            log.info("aw-app-tasks: scheduler watchdog registered")

        log.info("aw-app-tasks activated")

    def register_contributed_task(self, app_id: str, spec: dict) -> bool:
        """Seed one ``contributes.tasks`` declaration. True if it was created.

        This is the provider side of the workspace's task-contribution
        protocol (aw-workspace ``src/apps/tasks.py``): an app declares the
        schedules its features need, and the workspace hands each one here on
        activation.

        **Create-if-absent, matched by name, never updated.** An existing
        task of the same name is left exactly as it is — enabled or not,
        rescheduled or not, command rewritten or not. A schedule is something
        a user tunes, and an app re-asserting its own version on every boot
        would silently undo that. Matching on the name (rather than an id the
        app assigns) also means a task the user already created by hand is
        recognised instead of duplicated.

        Called from the workspace's activation path, which is synchronous and
        already guards against exceptions; raising here is safe but pointless.
        """
        name = str(spec.get("name") or "").strip()
        if not name:
            return False
        if any(t.get("name") == name for t in self.store.list()):
            log.info("aw-app-tasks: task %r already exists — leaving it untouched", name)
            return False

        task_type = spec.get("type", "terminal")
        notify = spec.get("notify_exit_codes")
        if isinstance(notify, (list, tuple)):
            notify = ",".join(str(c) for c in notify)
        self.store.create(
            name=name,
            type=task_type,
            cli_type=spec.get("cli_type", "terminal"),
            prompt=spec.get("prompt", "") or "",
            command=spec.get("command"),
            notify_exit_codes=notify,
            schedules=list(spec.get("schedules") or []),
            # Default OFF: a task that starts firing the moment an app is
            # installed is a surprise, and the seeded schedule is a
            # suggestion the user opts into. An app can override, but the
            # quiet default is the right one.
            enabled=bool(spec.get("enabled", False)),
            # type='agent_prompt' routing. Dropped until 2026-08-13, which
            # made an app-contributed agent_prompt task unfireable: the row
            # was created with agent_slug NULL, and _run_agent_prompt has
            # nothing to dispatch to. An app that ships both an agent
            # (contributes.agents) and the schedule driving it has to be able
            # to name that agent here. aw-workspace validates the pair at
            # install time (src/apps/manifest.py), so a slug is present
            # whenever the type is agent_prompt.
            agent_slug=(str(spec.get("agent_slug") or "").strip() or None),
            reuse_session=bool(spec.get("reuse_session", False)),
        )
        log.info("aw-app-tasks: seeded task %r contributed by %s", name, app_id)
        return True

    async def deactivate(self) -> None:
        log.info("aw-app-tasks deactivated")

    async def _tick(self) -> None:
        """Scan for due, enabled tasks and fire them — replaces the
        monolith's ``TaskScheduler._tick``. Mirrors its guard: a task
        already mid-run (``manager._firing``) is skipped so a slow run
        doesn't get re-fired every tick until it advances next_fire_at."""
        now = time.time()
        for task in self.store.list():
            if not task.get("enabled"):
                continue
            nf = task.get("next_fire_at")
            if nf is None or now < nf:
                continue
            if self.manager.is_firing(task["id"]):
                continue
            try:
                # start, don't await — a 30-minute agent_prompt run would
                # otherwise block this tick and starve every other schedule.
                # The _firing guard above still prevents a re-fire.
                await self.manager.start_task(task["id"], trigger="cron")
            except Exception:
                log.exception("Task %s: scheduled fire failed", task["id"])
