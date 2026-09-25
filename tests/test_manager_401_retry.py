"""Regression coverage for the refresh-on-401-and-retry-once half of Kanban
design:tasks-app-token-auto-refresh — TaskManager._dispatch_agent (the
private helper unifying the former agentic_output/agent_prompt dispatch
sites) must force-refresh a rejected agents_platform_token exactly once and
retry the dispatch, never looping past that one retry.

This is one half of two independent mechanisms (the other is the periodic
identity-token watchdog in plugin.py) — mutation-test them separately:
un-apply this retry and confirm these tests fail; un-apply the watchdog and
confirm test_identity_token_watchdog.py fails. A half-life watchdog cannot
see a token that is still unexpired but was invalidated early (signing-key
rotation, owner change, a Postgres cluster restore); this retry cannot stop
a token from expiring unattended between task firings — see
identity_token.py's module docstring.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app import agents_platform_client  # noqa: E402
from tasks_app import identity_token as idt  # noqa: E402
from tasks_app.manager import TaskManager  # noqa: E402


class _StubCtx:
    def __init__(self, config: dict) -> None:
        self.config = config

    def has(self, capability: str) -> bool:
        return False


def _task(**overrides) -> dict:
    task = {
        "id": "t1",
        "type": "agent_prompt",
        "agent_slug": "coder-sonnet",
        "prompt": "do the thing",
        "reuse_session": False,
    }
    task.update(overrides)
    return task


def _run() -> dict:
    return {"status": "running", "session_id": None, "output": None, "error": None}


def test_dispatch_refreshes_and_retries_once_on_401(monkeypatch):
    config = {
        "agents_platform_base": "https://ap.example",
        "agents_platform_token": "stale-token",
    }
    ctx = _StubCtx(config)
    manager = TaskManager(ctx, store=None)

    calls = []

    async def fake_run_agent(*, base, token, slug, prompt, target_slug, session_id):
        calls.append(token)
        if token == "stale-token":
            raise agents_platform_client.AgentsPlatformUnauthorized("401")
        return {"run_id": "r1", "text": "ok", "session_id": None, "is_error": False}

    monkeypatch.setattr(agents_platform_client, "run_agent", fake_run_agent)
    monkeypatch.setattr(idt, "refresh", lambda cfg, force=False: "fresh-token" if force else None)

    dispatched = asyncio.get_event_loop().run_until_complete(manager._dispatch_agent(_task(), _run(), prompt="do the thing"))

    assert dispatched is True
    assert calls == ["stale-token", "fresh-token"]
    assert config["agents_platform_token"] == "fresh-token"


def test_dispatch_gives_up_after_one_retry_when_refresh_fails(monkeypatch):
    config = {
        "agents_platform_base": "https://ap.example",
        "agents_platform_token": "stale-token",
    }
    ctx = _StubCtx(config)
    manager = TaskManager(ctx, store=None)

    calls = []

    async def fake_run_agent(*, base, token, slug, prompt, target_slug, session_id):
        calls.append(token)
        raise agents_platform_client.AgentsPlatformUnauthorized("401")

    monkeypatch.setattr(agents_platform_client, "run_agent", fake_run_agent)
    # force=True refresh itself fails (aw-backend unreachable, etc.)
    monkeypatch.setattr(idt, "refresh", lambda cfg, force=False: None)

    run = _run()
    dispatched = asyncio.get_event_loop().run_until_complete(manager._dispatch_agent(_task(), run, prompt="do the thing"))

    assert dispatched is False
    assert run["status"] == "error"
    assert "401" in run["error"]
    # never touched the network a second time — no token to retry with
    assert calls == ["stale-token"]
    assert config["agents_platform_token"] == "stale-token"


def test_dispatch_does_not_retry_a_second_time_when_retry_itself_401s(monkeypatch):
    """Exactly one retry: if the refreshed token is ALSO rejected, this must
    not loop — it gives up and reports the error."""
    config = {
        "agents_platform_base": "https://ap.example",
        "agents_platform_token": "stale-token",
    }
    ctx = _StubCtx(config)
    manager = TaskManager(ctx, store=None)

    calls = []

    async def fake_run_agent(*, base, token, slug, prompt, target_slug, session_id):
        calls.append(token)
        raise agents_platform_client.AgentsPlatformUnauthorized("401")

    monkeypatch.setattr(agents_platform_client, "run_agent", fake_run_agent)
    monkeypatch.setattr(idt, "refresh", lambda cfg, force=False: "still-bad-token" if force else None)

    run = _run()
    dispatched = asyncio.get_event_loop().run_until_complete(manager._dispatch_agent(_task(), run, prompt="do the thing"))

    assert dispatched is False
    assert run["status"] == "error"
    # exactly two attempts total: the original + the one retry, never a third
    assert calls == ["stale-token", "still-bad-token"]


def test_dispatch_no_retry_needed_when_token_is_valid(monkeypatch):
    config = {
        "agents_platform_base": "https://ap.example",
        "agents_platform_token": "good-token",
    }
    ctx = _StubCtx(config)
    manager = TaskManager(ctx, store=None)

    calls = []

    async def fake_run_agent(*, base, token, slug, prompt, target_slug, session_id):
        calls.append(token)
        return {"run_id": "r1", "text": "ok", "session_id": None, "is_error": False}

    def _refresh_should_not_be_called(cfg, force=False):
        raise AssertionError("refresh() must not be called when the dispatch succeeds")

    monkeypatch.setattr(agents_platform_client, "run_agent", fake_run_agent)
    monkeypatch.setattr(idt, "refresh", _refresh_should_not_be_called)

    dispatched = asyncio.get_event_loop().run_until_complete(manager._dispatch_agent(_task(), _run(), prompt="do the thing"))

    assert dispatched is True
    assert calls == ["good-token"]


def test_dispatch_non_401_error_is_not_retried(monkeypatch):
    config = {
        "agents_platform_base": "https://ap.example",
        "agents_platform_token": "good-token",
    }
    ctx = _StubCtx(config)
    manager = TaskManager(ctx, store=None)

    calls = []

    async def fake_run_agent(*, base, token, slug, prompt, target_slug, session_id):
        calls.append(token)
        raise agents_platform_client.AgentsPlatformError("HTTP 500 boom")

    def _refresh_should_not_be_called(cfg, force=False):
        raise AssertionError("refresh() must only fire on a 401")

    monkeypatch.setattr(agents_platform_client, "run_agent", fake_run_agent)
    monkeypatch.setattr(idt, "refresh", _refresh_should_not_be_called)

    run = _run()
    dispatched = asyncio.get_event_loop().run_until_complete(manager._dispatch_agent(_task(), run, prompt="do the thing"))

    assert dispatched is False
    assert run["status"] == "error"
    assert calls == ["good-token"]
