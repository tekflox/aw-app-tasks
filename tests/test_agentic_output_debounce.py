"""Regression test for the 2026-08-18/20 dispatch storm: an ``agentic_output``
task whose command stayed at the same notable exit code for 27.5h fired the
configured agent on every 30-minute cron tick (58 runs, ~$20) instead of once
per occurrence. ``_run_agentic_output`` must debounce on an unchanged notable
exit code and re-arm once the command recovers.

Uses ``asyncio.get_event_loop().run_until_complete`` — same pattern as
``test_mcp_surface.py`` — rather than ``asyncio.run`` or
``pytest.mark.asyncio``. ``asyncio.run`` explicitly clears the "current"
event loop on exit, which breaks ``test_mcp_surface.py``'s
``get_event_loop()`` calls for the rest of the session; there is no
asyncio_mode configured for pytest-asyncio here either.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app import agentic_output, agents_platform_client  # noqa: E402
from tasks_app.manager import TaskManager  # noqa: E402


class FakeStore:
    def __init__(self, task: dict):
        self.task = task
        self.notified_codes: list[int | None] = []

    def set_last_notified_exit_code(self, task_id, exit_code):
        self.task["last_notified_exit_code"] = exit_code
        self.notified_codes.append(exit_code)

    def set_ap_session_id(self, task_id, ap_session_id):
        self.task["ap_session_id"] = ap_session_id


class FakeCtx:
    def __init__(self):
        self.config = {
            "agents_platform_base": "https://ap.example",
            "agents_platform_token": "tok",
        }


def make_task(**overrides):
    task = {
        "id": "task-1", "command": "check-thing", "notify_exit_codes": "1",
        "agent_slug": "system-analyst", "prompt": "diagnose it",
        "reuse_session": False, "ap_session_id": None,
        "last_notified_exit_code": None,
    }
    task.update(overrides)
    return task


def make_manager(task: dict) -> tuple[TaskManager, FakeStore]:
    store = FakeStore(task)
    mgr = TaskManager(FakeCtx(), store)
    return mgr, store


def fire(mgr, task, exit_code, agent_calls):
    """Run one tick with the command patched to a fixed exit code and
    run_agent patched to a fake that records calls, restoring both after."""
    orig_run_command = agentic_output.run_command
    orig_run_agent = agents_platform_client.run_agent

    agentic_output.run_command = lambda *a, **k: (exit_code, "output")

    async def fake_run_agent(**kwargs):
        agent_calls.append(kwargs)
        return {"run_id": "run-x", "text": "ok", "is_error": False, "session_id": None}

    agents_platform_client.run_agent = fake_run_agent
    try:
        run = {"exit_code": None, "notified": None, "status": None, "output": None,
               "error": None, "session_id": None}
        asyncio.get_event_loop().run_until_complete(mgr._run_agentic_output(task, run))
        return run
    finally:
        agentic_output.run_command = orig_run_command
        agents_platform_client.run_agent = orig_run_agent


def test_persistently_failing_check_only_notifies_once():
    """The storm scenario: exit code stuck at 1 across many consecutive ticks
    must invoke the agent on the first tick only."""
    task = make_task()
    mgr, _store = make_manager(task)
    agent_calls: list[dict] = []

    run1 = fire(mgr, task, 1, agent_calls)
    assert run1["notified"] is True
    assert len(agent_calls) == 1

    # Simulate 56 more 30-min ticks with the same still-broken exit code.
    for _ in range(56):
        run = fire(mgr, task, 1, agent_calls)
        assert run["notified"] is False
        assert "debounced" in run["output"]

    assert len(agent_calls) == 1, "agent must not be re-invoked while unchanged"


def test_recovery_then_new_failure_notifies_again():
    task = make_task()
    mgr, _store = make_manager(task)
    agent_calls: list[dict] = []

    fire(mgr, task, 1, agent_calls)
    assert len(agent_calls) == 1

    # Recovers to exit 0 — re-arms the debounce.
    run_ok = fire(mgr, task, 0, agent_calls)
    assert run_ok["notified"] is False
    assert task["last_notified_exit_code"] is None

    # Fails again later — must notify again, not stay suppressed.
    run2 = fire(mgr, task, 1, agent_calls)
    assert run2["notified"] is True
    assert len(agent_calls) == 2


def test_different_notable_exit_code_notifies_again():
    task = make_task(notify_exit_codes="1,2")
    mgr, _store = make_manager(task)
    agent_calls: list[dict] = []

    fire(mgr, task, 1, agent_calls)
    assert len(agent_calls) == 1

    # A different notable exit code is a different problem — notify again.
    run2 = fire(mgr, task, 2, agent_calls)
    assert run2["notified"] is True
    assert len(agent_calls) == 2
