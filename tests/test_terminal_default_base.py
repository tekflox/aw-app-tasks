"""Regression test: `terminal`-type tasks must not require
``config.terminals_api_base`` to be set manually — the core's own terminals
API always lives in the same container, so ``_run_terminal`` derives
``http://127.0.0.1:{AW_PORT}`` when the config value is absent. See Kanban
card "terminals_api_base deve ter default automático" (3dc5bf3b-9510-8104-
ae28-e91c99e5096f) — the 3 contributed "Sync: *" tasks failed on any
workspace where nobody had set this by hand.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app import terminal_client  # noqa: E402
from tasks_app.manager import TaskManager  # noqa: E402


class FakeStore:
    def __init__(self):
        self.session_ids: dict[str, str] = {}

    def set_session_id(self, task_id, session_id):
        self.session_ids[task_id] = session_id


class FakeCtx:
    def __init__(self, config: dict):
        self.config = config

    def has(self, capability: str) -> bool:
        return False


def make_task(**overrides):
    task = {
        "id": "task-1", "name": "Sync: Foo", "prompt": "run the sync",
        "session_id": None, "cli_type": "terminal",
    }
    task.update(overrides)
    return task


def fire(config: dict, task: dict, calls: list):
    orig_ensure = terminal_client.ensure_session
    orig_write = terminal_client.write_prompt

    async def fake_ensure_session(base_url, **kwargs):
        calls.append(("ensure_session", base_url))
        return "sess-1"

    async def fake_write_prompt(base_url, session_id, prompt, **kwargs):
        calls.append(("write_prompt", base_url))

    terminal_client.ensure_session = fake_ensure_session
    terminal_client.write_prompt = fake_write_prompt
    try:
        mgr = TaskManager(FakeCtx(config), FakeStore())
        run = {"status": None, "session_id": None}
        asyncio.get_event_loop().run_until_complete(mgr._run_terminal(task, run))
        return run
    finally:
        terminal_client.ensure_session = orig_ensure
        terminal_client.write_prompt = orig_write


def test_defaults_to_loopback_aw_port_when_unset(monkeypatch):
    monkeypatch.setenv("AW_PORT", "9123")
    calls: list = []
    run = fire({}, make_task(), calls)

    assert run["status"] == "ok"
    assert calls == [
        ("ensure_session", "http://127.0.0.1:9123"),
        ("write_prompt", "http://127.0.0.1:9123"),
    ]


def test_defaults_to_9030_when_aw_port_unset(monkeypatch):
    monkeypatch.delenv("AW_PORT", raising=False)
    calls: list = []
    fire({}, make_task(), calls)

    assert calls[0] == ("ensure_session", "http://127.0.0.1:9030")


def test_explicit_config_value_overrides_default(monkeypatch):
    monkeypatch.setenv("AW_PORT", "9123")
    calls: list = []
    fire({"terminals_api_base": "http://127.0.0.1:9999"}, make_task(), calls)

    assert calls[0] == ("ensure_session", "http://127.0.0.1:9999")
