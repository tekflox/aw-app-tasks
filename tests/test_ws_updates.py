"""The ``/ws/updates`` socket and the fan-out behind it.

Four things, each of which has already gone wrong somewhere in this workspace:

1. **The handshake exists.** ``aw-ws/1`` (aw-workspace
   ``docs/standards/app-backend-websocket-messaging.md`` §4.3) makes the
   ``<domain>_init`` first frame mandatory *because* it carries
   ``data.protocol`` — a socket that sends nothing until something happens
   gives a client no way to detect a version it cannot speak.
2. **The envelope is exactly ``type`` + ``data``.** §3 records the live hazard
   this rule exists for: ``aw-app-git`` builds its frame as
   ``{"type": ..., **upstream_dict}`` and is one upstream key named ``type``
   away from silently becoming a different message.
3. **Cross-worker delivery.** ``AW_WORKSPACE_WORKERS=10``; a run finishing on
   the leader worker has to reach a browser socket on any of the other nine.
4. **A broken broadcast never fails a run.** ``TaskManager._finish_task``
   runs detached and swallows its own exceptions — the one place in this app
   where a silent failure looks exactly like success.

(3) is covered twice on purpose. ``TestCrossWorkerFanOutOverOneBus`` uses a
bus that models ``redis_coord``'s exact semantics and always runs, including
in CI where no Redis is guaranteed. ``TestCrossWorkerFanOutOverRealRedis``
proves the same thing over an actual Redis and skips when there isn't one —
same convention as aw-workspace's own
``src/tests/integration/api/test_w4_ws_registries_redis_relay.py``, whose
two-hub shape both classes copy.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app import routes as routes_mod  # noqa: E402
from tasks_app.manager import TaskManager  # noqa: E402
from tasks_app.updates import PROTOCOL, RELAY_TOPIC, TaskUpdates  # noqa: E402


# ----------------------------------------------------------------------
# doubles
# ----------------------------------------------------------------------

class FakeCtx:
    config = {}

    def has(self, _cap):
        return False

    def notify(self, *a, **k):
        return None


class FakeStore:
    """Only what the manager's run paths touch."""

    def __init__(self, tasks=None):
        self.tasks = {t["id"]: t for t in (tasks or [])}
        self.run_ids = 0
        self.finished: list[tuple[str, dict]] = []

    def list(self):
        return list(self.tasks.values())

    def get(self, task_id):
        return self.tasks.get(task_id)

    def next_run_id(self):
        self.run_ids += 1
        return f"run-{self.run_ids}"

    def insert_run(self, task_id, run):
        pass

    def record_run(self, task_id, run):
        self.finished.append((task_id, dict(run)))

    def finish_run(self, task_id, run):
        self.finished.append((task_id, dict(run)))


class FakeWebSocket:
    def __init__(self):
        self.received: list[str] = []

    async def send_text(self, msg):
        self.received.append(msg)


class FakeBus:
    """An in-process stand-in for one Redis instance, modelling exactly the
    property under test: ``publish`` reaches EVERY relay subscribed to the bus
    — including the publisher's own, since ``redis_coord`` deliberately has a
    single delivery path with no local shortcut. Also delivers every topic to
    every handler, like the real PSUBSCRIBE-over-the-namespace relay, so a
    handler that forgets to filter on its own topic fails here too."""

    def __init__(self):
        self.handlers: list = []

    def broadcaster(self):
        return _FakeBroadcaster(self)


class _FakeBroadcaster:
    def __init__(self, bus: FakeBus):
        self._bus = bus
        self._handler = None

    async def start_relay(self, handler):
        self._handler = handler
        self._bus.handlers.append(handler)

    async def publish(self, topic, payload):
        # Round-trip through JSON like the real one, so a payload that isn't
        # serialisable fails here rather than in production.
        decoded = json.loads(json.dumps(payload))
        for handler in list(self._bus.handlers):
            await handler(topic, decoded)
        return len(self._bus.handlers)

    async def stop(self):
        if self._handler in self._bus.handlers:
            self._bus.handlers.remove(self._handler)


def run(coro):
    """``asyncio.get_event_loop().run_until_complete`` — the pattern this
    repo's other async tests already use (see
    ``test_agentic_output_debounce.py``'s note on why not ``asyncio.run``)."""
    return asyncio.get_event_loop().run_until_complete(coro)


# ----------------------------------------------------------------------
# 1 + 2: the envelope
# ----------------------------------------------------------------------

def _assert_valid_envelope(frame: dict) -> None:
    """§4.1: exactly ``type`` and ``data``, ``data`` always an object.
    ``id``/``re`` are permitted but only on correlated frames, and this
    socket has none."""
    assert set(frame) == {"type", "data"}, (
        f"frame has top-level keys beyond type/data: {sorted(frame)} — §4.1/§4.2")
    assert isinstance(frame["type"], str) and frame["type"]
    assert isinstance(frame["data"], dict), "data must be an object, even when empty"


class TestEnvelope:
    def test_first_frame_is_the_init_handshake(self):
        api = routes_mod.build_routes(FakeCtx(), FakeStore(), None, TaskUpdates(share=False))
        with TestClient(api).websocket_connect("/ws/updates") as ws:
            frame = ws.receive_json()
        _assert_valid_envelope(frame)
        assert frame["type"] == "tasks_init"
        assert frame["data"]["protocol"] == PROTOCOL == 1

    def test_a_connected_client_receives_a_conformant_update_frame(self):
        updates = TaskUpdates(share=False)
        api = routes_mod.build_routes(FakeCtx(), FakeStore(), None, updates)
        with TestClient(api).websocket_connect("/ws/updates") as ws:
            assert ws.receive_json()["type"] == "tasks_init"
            run(updates.publish(task_id="t1", action="finish", status="ok",
                                run_id="run-1", trigger="cron"))
            frame = ws.receive_json()

        _assert_valid_envelope(frame)
        assert frame["type"] == "tasks_update"
        data = frame["data"]
        assert data["task_id"] == "t1"
        assert data["action"] == "finish"
        assert data["status"] == "ok"
        assert data["run_id"] == "run-1"
        assert data["trigger"] == "cron"
        assert isinstance(data["at"], float)

    def test_the_payload_stays_a_nudge_and_never_carries_the_run_output(self):
        """§1.1.1: this is the ephemeral kind of socket — REST stays the
        source of truth. Publishing the task dict would push an entire LLM
        response through Redis to every browser on every agent_prompt run."""
        updates = TaskUpdates(share=False)
        ws = FakeWebSocket()
        updates.add_listener(ws)
        run(updates.publish(task_id="t1", action="finish", status="ok"))
        data = json.loads(ws.received[0])["data"]
        assert set(data) == {"task_id", "action", "status", "run_id", "trigger", "at"}


class TestManagerBroadcasts:
    def test_finishing_a_run_pushes_a_finish_frame(self):
        """The reported bug: ``_finish_task`` settled the row and sent a toast
        and the window was never told (card 3d65bf3b-9510-8171-b5ce-eb05624b7bb7)."""
        updates = TaskUpdates(share=False)
        ws = FakeWebSocket()
        updates.add_listener(ws)
        store = FakeStore([{"id": "t1", "name": "T", "type": "unknown-type"}])
        mgr = TaskManager(FakeCtx(), store, updates)

        task = store.get("t1")
        run_row = mgr._new_run("manual")
        run(mgr._finish_task(task, run_row))

        frames = [json.loads(m) for m in ws.received]
        assert [f["data"]["action"] for f in frames] == ["finish"]
        assert frames[0]["data"]["task_id"] == "t1"

    def test_starting_a_run_pushes_a_start_frame(self):
        updates = TaskUpdates(share=False)
        ws = FakeWebSocket()
        updates.add_listener(ws)
        store = FakeStore([{"id": "t1", "name": "T", "type": "unknown-type"}])
        mgr = TaskManager(FakeCtx(), store, updates)

        run(mgr.start_task("t1"))
        actions = [json.loads(m)["data"]["action"] for m in ws.received]
        assert actions[0] == "start", actions

    def test_a_broadcast_failure_does_not_fail_the_run(self):
        """``_finish_task`` is detached and logs-and-swallows, so a raising
        broadcast would look like a healthy run AND skip the notification
        after it. Assert the run still settles."""
        class ExplodingUpdates(TaskUpdates):
            async def publish(self, **kwargs):
                raise RuntimeError("redis is on fire")

        store = FakeStore([{"id": "t1", "name": "T", "type": "unknown-type"}])
        mgr = TaskManager(FakeCtx(), store, ExplodingUpdates(share=False))

        task = store.get("t1")
        run_row = mgr._new_run("manual")
        run(mgr._finish_task(task, run_row))  # must not raise

        assert store.finished, "the run row was never settled"
        assert store.finished[-1][0] == "t1"
        assert "t1" not in mgr._firing, "the firing guard leaked"

    def test_publish_survives_an_unreachable_relay(self):
        """``_publish_frame``'s fallback: a failing Redis degrades to
        local-only delivery, loudly — it never drops the event."""
        class ExplodingBroadcaster:
            async def start_relay(self, handler):
                return None

            async def publish(self, topic, payload):
                raise RuntimeError("connection refused")

            async def stop(self):
                return None

        updates = TaskUpdates(broadcaster=ExplodingBroadcaster())
        run(updates.start_relay())
        ws = FakeWebSocket()
        updates.add_listener(ws)
        run(updates.publish(task_id="t1", action="finish", status="ok"))
        assert len(ws.received) == 1, "the event was dropped instead of delivered locally"


# ----------------------------------------------------------------------
# 3: cross-worker
# ----------------------------------------------------------------------

class TestCrossWorkerFanOutOverOneBus:
    """Two independent hub objects standing in for two worker processes, one
    bus between them — the exact shape of
    ``test_w4_ws_registries_redis_relay.py``, minus the Redis dependency so it
    runs everywhere, including release CI."""

    def test_publish_on_worker_a_reaches_a_listener_on_worker_b(self):
        async def scenario():
            bus = FakeBus()
            worker_a = TaskUpdates(broadcaster=bus.broadcaster())
            worker_b = TaskUpdates(broadcaster=bus.broadcaster())
            await worker_a.start_relay()
            await worker_b.start_relay()

            ws_b = FakeWebSocket()
            worker_b.add_listener(ws_b)

            # worker_a has no listeners and never touches ws_b — delivery must
            # come exclusively through the relay.
            await worker_a.publish(task_id="t1", action="finish", status="ok",
                                   run_id="run-1", trigger="cron")
            await worker_a.aclose()
            await worker_b.aclose()
            return ws_b.received

        received = run(scenario())
        assert received, "nothing reached the other worker's listener"
        frame = json.loads(received[-1])
        _assert_valid_envelope(frame)
        assert frame["type"] == "tasks_update"
        assert frame["data"]["task_id"] == "t1"

    def test_the_publishing_worker_delivers_exactly_once(self):
        """redis_coord's single-delivery-path rule
        (``src/api/notifications.py::_publish``): the producer only ever
        PUBLISHes, and its OWN relay is what fans the frame out locally.
        Calling ``_broadcast`` from the producer as well would double every
        frame in the publishing process."""
        async def scenario():
            bus = FakeBus()
            worker_a = TaskUpdates(broadcaster=bus.broadcaster())
            await worker_a.start_relay()
            ws_a = FakeWebSocket()
            worker_a.add_listener(ws_a)
            await worker_a.publish(task_id="t1", action="start")
            await worker_a.aclose()
            return ws_a.received

        assert len(run(scenario())) == 1

    def test_another_subsystems_broadcast_is_ignored(self):
        """The relay is a PSUBSCRIBE over every topic in the workspace
        namespace, so this handler really does see other subsystems' traffic
        (``apps:changed``, ``notifications``, ``terminal-status``, …)."""
        async def scenario():
            bus = FakeBus()
            worker = TaskUpdates(broadcaster=bus.broadcaster())
            await worker.start_relay()
            ws = FakeWebSocket()
            worker.add_listener(ws)
            await worker._on_relay_message("notifications", {"type": "ninja_notification"})
            await worker._on_relay_message(RELAY_TOPIC, {"type": "tasks_update", "data": {}})
            await worker.aclose()
            return ws.received

        received = run(scenario())
        assert len(received) == 1
        assert json.loads(received[0])["type"] == "tasks_update"


def _redis_url() -> str:
    for var in ("AW_TEST_REDIS_URL", "AW_WORKSPACE_REDIS_URL", "AW_REDIS_URL"):
        url = os.environ.get(var)
        if url:
            return url
    return "redis://127.0.0.1:6379/0"


def _real_relay_available() -> bool:
    """Both halves have to be there: core's ``src.libs.redis_coord`` (absent
    when this repo's tests run standalone, e.g. release CI) and a live Redis."""
    try:
        import redis as sync_redis  # noqa: F401

        sys.path.insert(0, "/opt/aw-workspace")
        from src.libs.redis_coord import RedisBroadcaster  # noqa: F401

        return bool(sync_redis.Redis.from_url(
            _redis_url(), socket_connect_timeout=2).ping())
    except Exception:
        return False


@pytest.mark.skipif(
    not _real_relay_available(),
    reason="needs an aw-workspace checkout on sys.path AND a reachable Redis")
class TestCrossWorkerFanOutOverRealRedis:
    """The same assertion as above against a real ``RedisBroadcaster`` over a
    real Redis. An in-process bus cannot prove what is actually under test —
    two asyncio tasks with no shared Python state converging purely through
    PUBLISH/PSUBSCRIBE, which is the real ten-process topology."""

    def test_publish_on_worker_a_reaches_a_listener_on_worker_b(self):
        async def scenario():
            from src.libs.redis_coord import RedisBroadcaster

            url = _redis_url()
            worker_a = TaskUpdates(broadcaster=RedisBroadcaster(url))
            worker_b = TaskUpdates(broadcaster=RedisBroadcaster(url))
            await worker_a.start_relay()
            await worker_b.start_relay()

            ws_b = FakeWebSocket()
            worker_b.add_listener(ws_b)

            marker = f"t-{time.time()}"
            await worker_a.publish(task_id=marker, action="finish", status="ok")

            deadline = time.time() + 5.0
            while time.time() < deadline and not ws_b.received:
                await asyncio.sleep(0.05)

            await worker_a.aclose()
            await worker_b.aclose()
            return marker, ws_b.received

        marker, received = run(scenario())
        assert received, "nothing crossed the real Redis relay"
        frame = json.loads(received[-1])
        _assert_valid_envelope(frame)
        assert frame["data"]["task_id"] == marker
