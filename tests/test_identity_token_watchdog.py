"""Regression coverage for the identity-token refresh watchdog half of
Kanban design:tasks-app-token-auto-refresh — ported from
aw-app-agents-platform-runners's test_identity_token_watchdog.py (same
run_immediately=True reasoning: WatchdogSupervisor.resume(), aw-workspace
core's src/apps/watchdog.py, restarts a run_immediately=False task's
sleep-then-tick loop from scratch on every RedisLease("core") leadership
handoff, so a freshly-promoted leader's own stale token would not be
re-checked for up to a further IDENTITY_TOKEN_INTERVAL_S).

Unlike the runners app, this watchdog reads/writes ctx.config directly
(tasks_app has no _live_config snapshot — see plugin.py's
_register_identity_token_watchdog docstring for why) and the capability gate
lives in activate(), not in this method — so the "not registered without
capability" case, and the "activate() actually calls this method at all"
case, are covered below at the activate() level instead (with everything
else activate() touches — TaskStore, TaskUpdates, routes, mcp self-register —
stubbed out). Caught live in this card's own mutation-testing pass: a test
suite that only calls _register_identity_token_watchdog() directly passed
unchanged when the call site in activate() was commented out.

This is one half of two independent mechanisms (the other is manager.py's
refresh-on-401-retry) — mutation-test them separately: un-apply this
watchdog and confirm these tests fail; un-apply the 401 retry and confirm
test_manager_401_retry.py fails.

Run: python -m pytest tests/test_identity_token_watchdog.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app import plugin as plugin_mod  # noqa: E402
from tasks_app.plugin import TasksAppPlugin  # noqa: E402


class _StubWatchdog:
    def __init__(self) -> None:
        self.registered: list[tuple] = []

    def register(self, name, fn, interval, run_immediately=False) -> None:
        self.registered.append((name, fn, interval, run_immediately))


class _StubCtx:
    def __init__(self, config: dict) -> None:
        self.config = config
        self.watchdog = _StubWatchdog()

    def has(self, capability: str) -> bool:
        return True


class _ActivateCtx(_StubCtx):
    """Enough of ``ctx`` for :meth:`TasksAppPlugin.activate` to run with
    TaskStore/TaskUpdates/routes/mcp self-register stubbed out below."""

    def __init__(self, config: dict, *, has_watchdog_cap: bool = True) -> None:
        super().__init__(config)
        self._has_watchdog_cap = has_watchdog_cap
        self.routes = _NoopRoutes()
        self.package_dir = "/tmp"

    def has(self, capability: str) -> bool:
        if capability == "watchdog:tasks":
            return self._has_watchdog_cap
        return False


class _NoopRoutes:
    def register(self, app) -> None:
        pass


class _FakeStore:
    def __init__(self, ctx) -> None:
        pass


class _FakeUpdates:
    async def start_relay(self) -> None:
        return None


def test_watchdog_registers_with_run_immediately_true():
    """The actual fix: a stale token on a freshly-promoted leader must be
    caught on its first tick, not up to IDENTITY_TOKEN_INTERVAL_S (6h) later
    — this is what makes WatchdogSupervisor.resume() (core) tick this task
    immediately on every RedisLease("core") acquisition, not just once at
    process boot."""
    plugin = TasksAppPlugin()
    ctx = _StubCtx({})

    plugin._register_identity_token_watchdog(ctx)

    assert len(ctx.watchdog.registered) == 1
    name, _fn, interval, run_immediately = ctx.watchdog.registered[0]
    assert name == "identity-token"
    assert interval == plugin_mod.IDENTITY_TOKEN_INTERVAL_S
    assert run_immediately is True


def test_tick_refreshes_and_updates_ctx_config(monkeypatch):
    calls = []

    def fake_refresh(config):
        calls.append(dict(config))
        return "freshly-refreshed"

    monkeypatch.setattr(plugin_mod.identity_token_mod, "refresh", fake_refresh)

    plugin = TasksAppPlugin()
    config = {"agents_platform_token": "stale-tok-past-half-life"}
    ctx = _StubCtx(config)
    plugin._register_identity_token_watchdog(ctx)
    _name, tick, _interval, run_immediately = ctx.watchdog.registered[0]

    assert run_immediately is True  # this tick fires on leader acquisition, not after a sleep
    asyncio.get_event_loop().run_until_complete(tick())

    assert config["agents_platform_token"] == "freshly-refreshed"
    assert len(calls) == 1
    assert calls[0]["agents_platform_token"] == "stale-tok-past-half-life"


def test_tick_is_a_noop_when_token_not_due(monkeypatch):
    monkeypatch.setattr(plugin_mod.identity_token_mod, "refresh", lambda config: None)

    plugin = TasksAppPlugin()
    config = {"agents_platform_token": "fresh-tok"}
    ctx = _StubCtx(config)
    plugin._register_identity_token_watchdog(ctx)
    _name, tick, _interval, _run_immediately = ctx.watchdog.registered[0]

    asyncio.get_event_loop().run_until_complete(tick())

    assert config["agents_platform_token"] == "fresh-tok"


def test_tick_survives_refresh_raising(monkeypatch):
    def _boom(config):
        raise RuntimeError("aw-backend unreachable")

    monkeypatch.setattr(plugin_mod.identity_token_mod, "refresh", _boom)

    plugin = TasksAppPlugin()
    ctx = _StubCtx({})
    plugin._register_identity_token_watchdog(ctx)
    _name, tick, _interval, _run_immediately = ctx.watchdog.registered[0]

    asyncio.get_event_loop().run_until_complete(tick())  # must not raise


# --- activate() wiring: does the real call site actually register this? ----
# The tests above prove _register_identity_token_watchdog() behaves correctly
# in isolation, but prove nothing about whether activate() still calls it —
# exactly the gap a mutation-testing pass is for (see module docstring).


def _stub_activate_deps(monkeypatch) -> None:
    monkeypatch.setattr(plugin_mod, "TaskStore", _FakeStore)
    monkeypatch.setattr(plugin_mod, "TaskUpdates", _FakeUpdates)
    monkeypatch.setattr(plugin_mod.routes_mod, "build_routes", lambda *a, **k: object())
    monkeypatch.setattr(plugin_mod.mcp_self_register, "register_self", lambda *a, **k: None)


def test_activate_registers_identity_token_watchdog_when_capability_granted(monkeypatch):
    _stub_activate_deps(monkeypatch)
    plugin = TasksAppPlugin()
    ctx = _ActivateCtx({}, has_watchdog_cap=True)

    asyncio.get_event_loop().run_until_complete(plugin.activate(ctx))

    names = [name for name, *_ in ctx.watchdog.registered]
    assert "identity-token" in names
    assert "scheduler" in names


def test_activate_does_not_register_identity_token_watchdog_without_capability(monkeypatch):
    _stub_activate_deps(monkeypatch)
    plugin = TasksAppPlugin()
    ctx = _ActivateCtx({}, has_watchdog_cap=False)

    asyncio.get_event_loop().run_until_complete(plugin.activate(ctx))

    assert ctx.watchdog.registered == []
