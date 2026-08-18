"""The MCP surface — the tool list the gateway serves, and the guards that
stop a caller creating a task that can never fire.

Driven with a fake store/manager so these run without Postgres or an Agents
Platform. What matters here is the contract an agent sees: the eight tools
exist, `create_task` refuses a slug-less agent task instead of writing a dead
row, and `open_task` answers "what happened last run" for a task type that
actually exists in this workspace.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app import validation  # noqa: E402
from tasks_app.mcp import http_handler, self_register  # noqa: E402


class FakeStore:
    def __init__(self, tasks=None, runs=None):
        self.tasks = {t["id"]: t for t in (tasks or [])}
        self.runs = list(runs or [])
        self.created: list[dict] = []
        self.updated: list[tuple[str, dict]] = []
        self.deleted: list[str] = []

    def list(self):
        return list(self.tasks.values())

    def get(self, task_id):
        return self.tasks.get(task_id)

    def create(self, **kwargs):
        self.created.append(kwargs)
        row = {"id": "task-new", "runs": [], **kwargs}
        self.tasks[row["id"]] = row
        return row

    def update(self, task_id, patch):
        self.updated.append((task_id, patch))
        self.tasks[task_id] = {**self.tasks[task_id], **patch}
        return self.tasks[task_id]

    def delete(self, task_id):
        self.deleted.append(task_id)
        return task_id in self.tasks

    def runs_for(self, task_id, limit=50):
        return [r for r in self.runs if r["task_id"] == task_id][:limit]


class FakeManager:
    def __init__(self, store):
        self.store = store
        self.started: list[str] = []

    async def start_task(self, task_id, *, trigger="manual"):
        if task_id not in self.store.tasks:
            raise KeyError(task_id)
        self.started.append(task_id)
        run = {"id": "run-1", "task_id": task_id, "status": "running",
               "trigger": trigger, "started_at": 1000.0}
        self.store.runs.insert(0, run)
        return run


class FakeCtx:
    config: dict = {}


def call(store, manager, tool, args=None, ctx=None):
    import asyncio
    return asyncio.get_event_loop().run_until_complete(
        http_handler.handle_request(
            {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
             "params": {"name": tool, "arguments": args or {}}},
            ctx=ctx or FakeCtx(), store=store, manager=manager,
        )
    )


def text_of(resp):
    return resp["result"]["content"][0]["text"]


@pytest.fixture
def store():
    return FakeStore(
        tasks=[{
            "id": "task-abc", "name": "Nightly digest", "type": "agent_prompt",
            "enabled": True, "agent_slug": "telegram-sonnet", "prompt": "go",
            "command": None, "schedules": [{"kind": "daily", "time": "09:00"}],
            "next_fire_at": 1000.0, "last_run_at": 900.0, "last_run_status": "ok",
            "runs": [],
        }],
        runs=[{"id": "run-9", "task_id": "task-abc", "status": "ok",
               "trigger": "cron", "started_at": 900.0, "exit_code": None,
               "notified": None, "session_id": "ap-run-42",
               "output": "digest sent", "error": None}],
    )


@pytest.fixture
def manager(store):
    return FakeManager(store)


# ── the surface itself ─────────────────────────────────────────────────────

def test_all_eight_monolith_tools_are_served():
    """The card's whole point: the gateway must see a tool list, and it must
    be the one the monolith's src/mcp/tasks.py had."""
    import asyncio
    resp = asyncio.get_event_loop().run_until_complete(
        http_handler.handle_request(
            {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
            ctx=FakeCtx(), store=None, manager=None,
        )
    )
    names = {t["name"] for t in resp["result"]["tools"]}
    assert names == {"list_tasks", "get_task", "create_task", "update_task",
                     "delete_task", "run_task", "open_task", "list_clis"}


def test_manifest_provides_matches_what_the_handler_serves():
    """A `provides` list that drifts from the code is how an app advertises
    tools it does not serve."""
    import json
    manifest = json.loads((Path(__file__).resolve().parents[1] / "aw-app.json").read_text())
    assert set(manifest["contributes"]["mcp"]["provides"]) == {
        t["name"] for t in http_handler.TOOLS_SCHEMA
    }


def test_self_register_entry_points_at_our_own_mcp_route():
    entry = self_register.build_self_entry(9030)
    assert entry["type"] == "http"
    assert entry["url"].endswith(":9030/api/apps/tasks/mcp")
    # 127.0.0.1 would resolve inside the gateway's netns, not ours.
    assert "127.0.0.1" not in entry["url"]


# ── the guard the card exists for ──────────────────────────────────────────

@pytest.mark.parametrize("task_type", ["agent_prompt", "agentic_output"])
def test_create_task_refuses_an_agent_task_with_no_slug(store, manager, task_type):
    resp = call(store, manager, "create_task",
                {"name": "T", "type": task_type, "prompt": "go", "command": "echo hi"})
    assert resp["result"]["isError"] is True
    assert "agent_slug" in text_of(resp)
    assert store.created == []


def test_create_task_with_a_slug_is_written(store, manager):
    resp = call(store, manager, "create_task", {
        "name": "T", "type": "agent_prompt", "prompt": "go",
        "agent_slug": "telegram-sonnet",
        "schedules": [{"kind": "daily", "time": "09:00"}],
    })
    assert resp["result"]["isError"] is False
    assert store.created[0]["agent_slug"] == "telegram-sonnet"


def test_create_task_refuses_a_schedule_the_scheduler_cannot_read(store, manager):
    resp = call(store, manager, "create_task", {
        "name": "T", "type": "terminal",
        "schedules": [{"kind": "cron", "expr": "not a cron"}],
    })
    assert resp["result"]["isError"] is True
    assert "cron" in text_of(resp)
    assert store.created == []


def test_update_cannot_strip_the_slug_off_a_live_agent_task(store, manager):
    resp = call(store, manager, "update_task", {"task_id": "task-abc", "agent_slug": ""})
    assert resp["result"]["isError"] is True
    assert store.updated == []


def test_update_can_still_disable_an_already_broken_task(store, manager):
    """A workspace may hold a slug-less agent_prompt row from before the
    guard existed. Refusing every edit to it would leave no way to turn the
    thing off."""
    store.tasks["task-broken"] = {"id": "task-broken", "name": "old", "runs": [],
                                  "type": "agent_prompt", "agent_slug": None,
                                  "enabled": True, "schedules": []}
    resp = call(store, manager, "update_task", {"task_id": "task-broken", "enabled": False})
    assert resp["result"]["isError"] is False
    assert store.updated == [("task-broken", {"enabled": False})]


# ── the rest of the cycle ──────────────────────────────────────────────────

def test_list_and_get(store, manager):
    assert '"task-abc"' in text_of(call(store, manager, "list_tasks"))
    assert "Nightly digest" in text_of(call(store, manager, "get_task", {"task_id": "task-abc"}))


def test_run_task_returns_immediately_by_default(store, manager):
    resp = call(store, manager, "run_task", {"task_id": "task-abc"})
    assert manager.started == ["task-abc"]
    assert '"still_running": true' in text_of(resp)


def test_missing_task_is_an_error_not_a_crash(store, manager):
    for tool in ("get_task", "run_task", "delete_task", "open_task"):
        resp = call(store, manager, tool, {"task_id": "task-nope"})
        assert resp["result"]["isError"] is True, tool
        assert "not found" in text_of(resp)


def test_task_id_is_required(store, manager):
    resp = call(store, manager, "get_task", {})
    assert resp["result"]["isError"] is True
    assert "task_id is required" in text_of(resp)


def test_open_task_returns_the_last_run_not_a_scrollback(store, manager):
    """The reimplementation the card asked for: this has to return something
    real, or it should not exist at all."""
    body = text_of(call(store, manager, "open_task", {"task_id": "task-abc"}))
    assert "digest sent" in body        # the output
    assert "ap-run-42" in body          # the Agents Platform run id
    assert '"status": "ok"' in body


def test_open_task_says_so_when_a_task_has_never_run(store, manager):
    store.tasks["task-fresh"] = {"id": "task-fresh", "name": "new", "runs": [],
                                 "type": "terminal", "enabled": True, "schedules": []}
    body = text_of(call(store, manager, "open_task", {"task_id": "task-fresh"}))
    assert "never run" in body


def test_delete_task(store, manager):
    resp = call(store, manager, "delete_task", {"task_id": "task-abc"})
    assert resp["result"]["isError"] is False
    assert store.deleted == ["task-abc"]


def test_list_clis_says_why_it_is_empty_rather_than_returning_nothing(store, manager):
    body = text_of(call(store, manager, "list_clis"))
    assert "agents_platform_base" in body
    assert "cli_types" in body


def test_unknown_tool_is_reported(store, manager):
    resp = call(store, manager, "nope")
    assert resp["result"]["isError"] is True
    assert "Unknown tool" in text_of(resp)


# ── validation module, used by both front doors ────────────────────────────

def test_normalize_create_matches_what_the_rest_route_used_to_build():
    kwargs, err = validation.normalize_create({"name": " T ", "type": "terminal",
                                               "cli_type": "claude"})
    assert err is None
    assert kwargs == {"name": "T", "type": "terminal", "cli_type": "claude",
                      "prompt": "", "command": None, "notify_exit_codes": None,
                      "schedules": [], "enabled": True, "agent_slug": None,
                      "reuse_session": False}


def test_cli_type_is_ignored_for_non_terminal_types():
    kwargs, _ = validation.normalize_create({"name": "T", "type": "agent_prompt",
                                             "agent_slug": "x", "cli_type": "claude"})
    assert kwargs["cli_type"] == "terminal"


def test_a_nameless_task_is_refused():
    _, err = validation.normalize_create({"type": "terminal"})
    assert err == "name is required"


def test_an_unknown_type_is_refused():
    _, err = validation.normalize_create({"name": "T", "type": "wat"})
    assert "unknown task type" in err
