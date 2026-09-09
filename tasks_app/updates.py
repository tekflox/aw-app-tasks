"""Live task-run updates pushed to the Tasks window over this app's own
WebSocket (``/api/apps/tasks/ws/updates``), replacing the 4s frontend poll
v0.23.0 shipped as a stopgap.

Speaks the workspace's ``aw-ws/1`` envelope
(``docs/standards/app-backend-websocket-messaging.md`` in aw-workspace, §4):
every frame is ``{"type": ..., "data": {...}}`` and nothing else at the top
level. The socket's first frame is always the ``tasks_init`` handshake
carrying ``data.protocol``, even when there is no state to send.

**Why the payload is this thin.** §1.1.1 of that standard splits sockets into
*persisted* (``/ws/notifications`` — a store is the source of truth, the
socket only accelerates it) and *ephemeral* (``/ws/status`` — a client that
missed the frame re-fetches over REST and loses nothing). This is the
ephemeral kind: the frame names *which* task changed and how, and the client
re-reads ``GET /tasks``. Inlining the task dict instead would mean publishing
every run's ``output`` — for an ``agent_prompt`` task, a whole LLM response —
through Redis pub/sub to every browser on every run, and would let the WS
copy disagree with what REST would return.

**Cross-worker fan-out is mandatory here, not a nicety.**
``AW_WORKSPACE_WORKERS=10`` (aw-workspace's ``Dockerfile:110``) forks ten
processes, and a browser's socket lives on whichever one accepted it. Worse
for the *cron* path specifically: the scheduler tick runs under core's
``RedisLease("core")`` leader gate, so a scheduled run always fires on the
leader worker — without this relay a cron update would reach roughly 1 in 10
open windows.

That fan-out uses ``src.libs.redis_coord.RedisBroadcaster`` **directly**. A
Tier-1 in-process app importing core's coordination primitive is already the
established pattern — ``apps/devctl/devctl_app/relay.py`` does exactly this
for its cross-worker eval relay — and the alternative (a ``ctx.broadcast``
facade in core) would need a core release before this app could use it, two
deploys to wrap a two-line import. Revisit if a third app writes the same
relay.

The single-delivery-path rule from ``src/api/notifications.py::_publish`` is
copied verbatim and matters: the producer only ever PUBLISHes, and each
worker's own PSUBSCRIBE relay — *including the publishing worker's* — is what
fans the frame out to local listeners. Calling ``_broadcast`` directly from
the producer would double-deliver in the publishing process.
"""
from __future__ import annotations

import json
import logging
import time

log = logging.getLogger("tasks_app.updates")

#: ``data.protocol`` in the ``tasks_init`` handshake (standard §4.3).
PROTOCOL = 1

#: RedisBroadcaster topic. Namespaced to this app: the relay is a PSUBSCRIBE
#: over every topic in the workspace namespace, so this handler *will* see
#: other subsystems' messages and has to filter.
RELAY_TOPIC = "tasks:updates"


class TaskUpdates:
    """One per worker process. Holds that worker's live sockets, and relays
    frames to and from every other worker over Redis.

    Modelled on ``src/api/notifications.py``'s ``NotificationManager``.
    ``broadcaster`` is injectable purely so the cross-worker tests can stand
    two of these up over one bus without a live Redis; production passes
    nothing and gets ``RedisBroadcaster``.
    """

    def __init__(self, *, share: bool = True, broadcaster=None):
        self._listeners: set = set()
        self._share = share
        self._broadcaster = broadcaster
        self._relay_up = False

    # ---- lifecycle ----------------------------------------------------

    async def start_relay(self) -> None:
        """Subscribe this worker to the ``tasks:updates`` relay.

        Never raises: a workspace whose Redis is unreachable still has to
        boot, and degrades to exactly ``AW_WORKSPACE_WORKERS=1`` behaviour —
        every listener on the publishing worker still gets the frame.
        """
        if not self._share:
            return
        try:
            if self._broadcaster is None:
                from src.libs.redis_coord import RedisBroadcaster

                self._broadcaster = RedisBroadcaster()
            await self._broadcaster.start_relay(self._on_relay_message)
            self._relay_up = True
            log.info("aw-app-tasks: subscribed to the %r relay for cross-worker "
                     "task-update fan-out", RELAY_TOPIC)
        except Exception:
            log.warning(
                "aw-app-tasks: could not start the Redis relay — this worker "
                "will only push task updates to sockets it owns itself until "
                "restarted (harmless at AW_WORKSPACE_WORKERS=1; see doctor's "
                "`redis` check)", exc_info=True)

    async def aclose(self) -> None:
        if self._broadcaster is not None:
            try:
                await self._broadcaster.stop()
            except Exception:  # noqa: BLE001 — shutdown path
                log.debug("aw-app-tasks: relay teardown raised", exc_info=True)
        self._relay_up = False

    # ---- listeners ----------------------------------------------------

    def add_listener(self, ws) -> None:
        self._listeners.add(ws)

    def remove_listener(self, ws) -> None:
        self._listeners.discard(ws)

    @property
    def listener_count(self) -> int:
        return len(self._listeners)

    # ---- publish ------------------------------------------------------

    async def publish(self, *, task_id: str, action: str, status=None,
                      run_id=None, trigger=None, at=None) -> None:
        """Fan a ``tasks_update`` frame out to every worker's listeners.

        Never raises. This is called from the run path — including
        ``TaskManager._finish_task``, which is detached and swallows its own
        exceptions, so a failure here would be invisible *and* would skip the
        notification step. A Redis hiccup must not make a successful run look
        failed.
        """
        frame = {
            "type": "tasks_update",
            "data": {
                "task_id": task_id,
                "action": action,
                "status": status,
                "run_id": run_id,
                "trigger": trigger,
                "at": time.time() if at is None else at,
            },
        }
        await self._publish_frame(frame)

    async def _publish_frame(self, frame: dict) -> None:
        """Single delivery path: publish to Redis and let this worker's own
        relay subscription fan it back out locally — never call
        ``_broadcast`` here on the success path, or the publishing worker
        delivers the frame twice. Falls back to local-only delivery, loudly,
        rather than dropping the event."""
        if self._relay_up and self._broadcaster is not None:
            try:
                await self._broadcaster.publish(RELAY_TOPIC, frame)
                return
            except Exception:
                log.warning("aw-app-tasks: Redis publish failed — falling back "
                            "to local-only delivery for this task update",
                            exc_info=True)
        try:
            await self._broadcast(frame)
        except Exception:
            log.warning("aw-app-tasks: could not deliver a task update to "
                        "local sockets", exc_info=True)

    async def _on_relay_message(self, topic: str, payload: dict) -> None:
        # The relay is a PSUBSCRIBE over the whole workspace namespace, so
        # every other subsystem's broadcasts land here too.
        if topic != RELAY_TOPIC:
            return
        await self._broadcast(payload)

    async def _broadcast(self, frame: dict) -> None:
        msg = json.dumps(frame)
        dead = []
        for ws in list(self._listeners):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._listeners.discard(ws)


def init_frame() -> dict:
    """The mandatory first frame (standard §4.3/§6.1). Sent even though this
    socket carries no initial state — its job is to negotiate ``protocol``
    before the client processes anything else."""
    return {"type": "tasks_init", "data": {"protocol": PROTOCOL}}
