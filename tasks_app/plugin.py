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
import time

from . import routes as routes_mod
from .manager import TaskManager
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

        if ctx.has("watchdog:tasks"):
            ctx.watchdog.register(
                "scheduler", self._tick, lambda: _scheduler_interval_s(ctx),
                run_immediately=False,
            )
            log.info("aw-app-tasks: scheduler watchdog registered")

        log.info("aw-app-tasks activated")

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
                await self.manager.run_task(task["id"], trigger="cron")
            except Exception:
                log.exception("Task %s: scheduled fire failed", task["id"])
