"""Generic params + env passthrough on task run (Kanban card
4155bf3b-9510-81ee) — {{params.KEY}} substitution in prompt/command, env
injection for subprocess-type executions only, with the reserved denylist,
and recording both on the run row.

Covers: validation.py (shared by both front doors), templating.py
(substitution), manager.py (threading + the terminal env rejection, the
subprocess env injection), store.py (the run row round-trip), and the two
front doors (routes.py, mcp/http_handler.py) agreeing with each other.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app import agentic_output, agents_platform_client, routes, templating, validation  # noqa: E402
from tasks_app.manager import TaskManager  # noqa: E402
from tasks_app.mcp import http_handler  # noqa: E402

# ── templating.render ───────────────────────────────────────────────────────


def test_render_substitutes_a_known_param():
    text, err = templating.render("hello {{params.NAME}}", {"NAME": "world"})
    assert err is None
    assert text == "hello world"


def test_render_substitutes_non_string_params_as_text():
    text, err = templating.render("count={{params.N}}", {"N": 3})
    assert err is None
    assert text == "count=3"


def test_render_is_a_noop_with_no_placeholders():
    text, err = templating.render("plain text", {})
    assert err is None
    assert text == "plain text"


def test_render_unknown_placeholder_with_no_default_is_an_error():
    text, err = templating.render("hello {{params.NAME}}", {})
    assert err is not None
    assert "NAME" in err
    assert text == "hello {{params.NAME}}"  # original text, unmodified


def test_render_falls_back_to_inline_default():
    text, err = templating.render("hello {{params.NAME|stranger}}", {})
    assert err is None
    assert text == "hello stranger"


def test_render_prefers_the_param_over_the_default():
    text, err = templating.render("hello {{params.NAME|stranger}}", {"NAME": "Fred"})
    assert err is None
    assert text == "hello Fred"


def test_render_reports_every_missing_placeholder_once():
    text, err = templating.render("{{params.A}} {{params.B}} {{params.A}}", {})
    assert err is not None
    assert "A" in err and "B" in err


# ── validation.validate_params ──────────────────────────────────────────────


def test_validate_params_accepts_the_documented_scalar_types():
    params, err = validation.validate_params({"a": "x", "b": 1, "c": 1.5, "d": True})
    assert err is None
    assert params == {"a": "x", "b": 1, "c": 1.5, "d": True}


def test_validate_params_none_is_empty():
    assert validation.validate_params(None) == ({}, None)


def test_validate_params_rejects_a_bad_key_shape():
    _, err = validation.validate_params({"1bad": "x"})
    assert err is not None and "1bad" in err


def test_validate_params_rejects_a_nested_value():
    _, err = validation.validate_params({"a": {"nested": 1}})
    assert err is not None and "a" in err


def test_validate_params_rejects_too_many_entries():
    many = {f"k{i}": i for i in range(validation.MAX_PARAMS + 1)}
    _, err = validation.validate_params(many)
    assert err is not None and "entries" in err


def test_validate_params_rejects_non_dict():
    _, err = validation.validate_params(["not", "a", "dict"])
    assert err is not None


# ── validation.validate_env ─────────────────────────────────────────────────


def test_validate_env_accepts_a_good_key():
    env, err = validation.validate_env({"CALLBACK_URL": "https://x"}, task_type="agentic_output")
    assert err is None
    assert env == {"CALLBACK_URL": "https://x"}


def test_validate_env_coerces_non_string_values():
    env, err = validation.validate_env({"RETRIES": 3}, task_type="agentic_output")
    assert err is None
    assert env == {"RETRIES": "3"}


def test_validate_env_rejects_a_lowercase_key():
    _, err = validation.validate_env({"callback_url": "x"}, task_type="agentic_output")
    assert err is not None


@pytest.mark.parametrize("bad_key", [
    "PATH", "HOME", "SHELL", "LD_PRELOAD", "LD_LIBRARY_PATH",
    "PYTHONPATH", "PYTHONHOME", "AW_WORKSPACE_API_KEY", "AW_PORT",
])
def test_validate_env_refuses_every_denylisted_key(bad_key):
    _, err = validation.validate_env({bad_key: "x"}, task_type="agentic_output")
    assert err is not None, bad_key
    assert bad_key in err


def test_validate_env_allows_a_key_that_merely_contains_a_denied_substring():
    """The denylist is prefix/exact, not substring — a key like
    MY_PYTHON_FLAG must not be caught by the PYTHON* prefix rule."""
    env, err = validation.validate_env({"MY_PYTHON_FLAG": "x"}, task_type="agentic_output")
    assert err is None
    assert env == {"MY_PYTHON_FLAG": "x"}


def test_validate_env_rejects_too_many_entries():
    many = {f"K{i}": "x" for i in range(validation.MAX_ENV_VARS + 1)}
    _, err = validation.validate_env(many, task_type="agentic_output")
    assert err is not None and "entries" in err


def test_validate_env_is_params_only_for_terminal_tasks():
    _, err = validation.validate_env({"FOO": "bar"}, task_type="terminal")
    assert err is not None
    assert "terminal" in err


def test_validate_env_empty_dict_is_fine_for_terminal_tasks():
    env, err = validation.validate_env({}, task_type="terminal")
    assert err is None
    assert env == {}


def test_validate_env_none_is_empty_even_for_terminal():
    assert validation.validate_env(None, task_type="terminal") == ({}, None)


# ── validation.validate_run_args (the shared door) ──────────────────────────


def test_validate_run_args_happy_path():
    out, err = validation.validate_run_args(
        {"params": {"X": "1"}, "env": {"Y": "2"}}, task_type="agentic_output")
    assert err is None
    assert out == {"params": {"X": "1"}, "env": {"Y": "2"}}


def test_validate_run_args_empty_body_is_fine():
    out, err = validation.validate_run_args({}, task_type="agent_prompt")
    assert err is None
    assert out == {"params": {}, "env": {}}


def test_validate_run_args_surfaces_the_env_error_for_terminal():
    out, err = validation.validate_run_args({"env": {"X": "1"}}, task_type="terminal")
    assert err is not None
    assert out == {}


# ── manager.py — prompt/command templating + env injection ─────────────────


class FakeCtx:
    def __init__(self, config=None):
        self.config = config or {
            "agents_platform_base": "https://ap.example",
            "agents_platform_token": "tok",
        }

    def has(self, capability):
        return False


class FakeStore:
    def __init__(self):
        self.session_ids = {}

    def set_session_id(self, task_id, session_id):
        self.session_ids[task_id] = session_id

    def set_ap_session_id(self, task_id, ap_session_id):
        pass

    def set_last_notified_exit_code(self, task_id, exit_code):
        pass


def run_coro(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_agent_prompt_substitutes_params():
    task = {"id": "t1", "type": "agent_prompt", "prompt": "do {{params.THING}}",
            "agent_slug": "some-agent"}
    run = {"status": None, "error": None, "session_id": None, "output": None,
           "params": {"THING": "the-sweep"}, "env": {}}

    captured = {}

    async def fake_run_agent(**kwargs):
        captured["prompt"] = kwargs["prompt"]
        return {"run_id": "run-x", "text": "ok", "is_error": False, "session_id": None}

    orig = agents_platform_client.run_agent
    agents_platform_client.run_agent = fake_run_agent
    try:
        mgr = TaskManager(FakeCtx(), FakeStore())
        run_coro(mgr._run_agent_prompt(task, run))
    finally:
        agents_platform_client.run_agent = orig

    assert captured["prompt"] == "do the-sweep"
    assert run["status"] == "ok"


def test_agent_prompt_unknown_placeholder_fails_the_run_without_dispatching():
    task = {"id": "t1", "type": "agent_prompt", "prompt": "do {{params.THING}}",
            "agent_slug": "some-agent"}
    run = {"status": None, "error": None, "params": {}, "env": {}}

    called = []

    async def fake_run_agent(**kwargs):
        called.append(kwargs)
        return {"run_id": "run-x", "text": "ok", "is_error": False, "session_id": None}

    orig = agents_platform_client.run_agent
    agents_platform_client.run_agent = fake_run_agent
    try:
        mgr = TaskManager(FakeCtx(), FakeStore())
        run_coro(mgr._run_agent_prompt(task, run))
    finally:
        agents_platform_client.run_agent = orig

    assert run["status"] == "error"
    assert "THING" in run["error"]
    assert called == [], "a template failure must not still dispatch to the agent"


def test_agentic_output_substitutes_params_in_command_and_env_in_subprocess():
    task = {"id": "t1", "type": "agentic_output",
            "command": "echo {{params.MSG}} $CALLBACK_URL",
            "agent_slug": "some-agent", "notify_exit_codes": "1",
            "prompt": "check it", "last_notified_exit_code": None}
    run = {"status": None, "error": None, "exit_code": None, "notified": None,
           "output": None, "session_id": None,
           "params": {"MSG": "hi"}, "env": {"CALLBACK_URL": "https://cb.example"}}

    seen_calls = []
    orig_run_command = agentic_output.run_command

    def fake_run_command(command, cwd=None, timeout_s=None, env=None):
        seen_calls.append({"command": command, "env": env})
        return 0, "ok"

    agentic_output.run_command = fake_run_command
    try:
        mgr = TaskManager(FakeCtx(), FakeStore())
        run_coro(mgr._run_agentic_output(task, run))
    finally:
        agentic_output.run_command = orig_run_command

    assert len(seen_calls) == 1
    assert seen_calls[0]["command"] == "echo hi $CALLBACK_URL"
    assert seen_calls[0]["env"]["CALLBACK_URL"] == "https://cb.example"
    # exit 0 is not notable for notify_exit_codes="1" — no agent dispatch needed
    assert run["status"] == "ok"


def test_agentic_output_bad_command_template_never_runs_the_subprocess():
    task = {"id": "t1", "type": "agentic_output", "command": "echo {{params.MISSING}}",
            "agent_slug": "some-agent", "notify_exit_codes": "1", "prompt": "x"}
    run = {"status": None, "error": None, "params": {}, "env": {}}

    called = []
    orig_run_command = agentic_output.run_command
    agentic_output.run_command = lambda *a, **k: called.append((a, k)) or (0, "")
    try:
        mgr = TaskManager(FakeCtx(), FakeStore())
        run_coro(mgr._run_agentic_output(task, run))
    finally:
        agentic_output.run_command = orig_run_command

    assert run["status"] == "error"
    assert "MISSING" in run["error"]
    assert called == [], "command must not run when its own template is broken"


def test_run_command_merges_env_on_top_of_the_real_environment(monkeypatch):
    monkeypatch.setenv("SOME_EXISTING_VAR", "already-here")
    exit_code, output = agentic_output.run_command(
        "echo $SOME_EXISTING_VAR-$EXTRA", env={"EXTRA": "added"})
    assert exit_code == 0
    assert output.strip() == "already-here-added"


def test_terminal_substitutes_params_in_prompt():
    task = {"id": "t1", "name": "T", "prompt": "run {{params.JOB}}",
            "session_id": None, "cli_type": "terminal"}
    run = {"status": None, "error": None, "session_id": None,
           "params": {"JOB": "nightly"}, "env": {}}

    from tasks_app import terminal_client
    calls = []

    async def fake_ensure_session(base_url, **kwargs):
        return "sess-1"

    async def fake_write_prompt(base_url, session_id, prompt, **kwargs):
        calls.append(prompt)

    orig_ensure, orig_write = terminal_client.ensure_session, terminal_client.write_prompt
    terminal_client.ensure_session = fake_ensure_session
    terminal_client.write_prompt = fake_write_prompt
    try:
        mgr = TaskManager(FakeCtx({}), FakeStore())
        run_coro(mgr._run_terminal(task, run))
    finally:
        terminal_client.ensure_session = orig_ensure
        terminal_client.write_prompt = orig_write

    assert calls == ["run nightly"]
    assert run["status"] == "ok"


def test_terminal_unknown_placeholder_fails_without_touching_the_session():
    task = {"id": "t1", "name": "T", "prompt": "run {{params.JOB}}",
            "session_id": None, "cli_type": "terminal"}
    run = {"status": None, "error": None, "session_id": None, "params": {}, "env": {}}

    from tasks_app import terminal_client
    calls = []
    orig_ensure = terminal_client.ensure_session
    terminal_client.ensure_session = lambda *a, **k: calls.append("called")
    try:
        mgr = TaskManager(FakeCtx({}), FakeStore())
        run_coro(mgr._run_terminal(task, run))
    finally:
        terminal_client.ensure_session = orig_ensure

    assert run["status"] == "error"
    assert "JOB" in run["error"]
    assert calls == []


# ── a cron-fired run with no params fails loudly, not silently ─────────────


def test_scheduler_fired_run_with_no_params_and_no_default_fails_the_run():
    """Point 5 of the card: a task whose prompt references {{params.X}} with
    no default must fail loudly on a cron fire, not render blank."""
    task = {"id": "t1", "type": "agent_prompt", "prompt": "process {{params.CARD_ID}}",
            "agent_slug": "some-agent"}
    run = {"status": None, "error": None, "params": {}, "env": {}}  # cron: no params

    async def fake_run_agent(**kwargs):
        raise AssertionError("must not dispatch when the template is broken")

    orig = agents_platform_client.run_agent
    agents_platform_client.run_agent = fake_run_agent
    try:
        mgr = TaskManager(FakeCtx(), FakeStore())
        run_coro(mgr._run_agent_prompt(task, run))
    finally:
        agents_platform_client.run_agent = orig

    assert run["status"] == "error"
    assert "CARD_ID" in run["error"]


def test_scheduler_fired_run_with_an_inline_default_succeeds():
    task = {"id": "t1", "type": "agent_prompt",
            "prompt": "process {{params.CARD_ID|none}}", "agent_slug": "some-agent"}
    run = {"status": None, "error": None, "session_id": None, "output": None,
           "params": {}, "env": {}}

    captured = {}

    async def fake_run_agent(**kwargs):
        captured["prompt"] = kwargs["prompt"]
        return {"run_id": "run-x", "text": "ok", "is_error": False, "session_id": None}

    orig = agents_platform_client.run_agent
    agents_platform_client.run_agent = fake_run_agent
    try:
        mgr = TaskManager(FakeCtx(), FakeStore())
        run_coro(mgr._run_agent_prompt(task, run))
    finally:
        agents_platform_client.run_agent = orig

    assert captured["prompt"] == "process none"


# ── REST routes: body validation + rejection ────────────────────────────────


class RouteFakeStore:
    def __init__(self, tasks):
        self.tasks = {t["id"]: t for t in tasks}

    def list(self):
        return list(self.tasks.values())

    def get(self, task_id):
        return self.tasks.get(task_id)

    def get_by_slug(self, slug):
        for t in self.tasks.values():
            if t.get("slug") == slug:
                return t
        return None


class RouteFakeManager:
    def __init__(self, store):
        self.store = store
        self.calls = []

    async def start_task(self, task_id, *, trigger="manual", params=None, env=None):
        self.calls.append({"task_id": task_id, "params": params, "env": env})
        return {"id": "run-1", "task_id": task_id, "status": "running",
                "trigger": trigger, "params": params or {}, "env": env or {}}


class RouteFakeCtx:
    config: dict = {}


@pytest.fixture
def route_client():
    store = RouteFakeStore([
        {"id": "task-agentic", "name": "Check", "slug": "check", "type": "agentic_output",
         "enabled": True, "command": "echo hi", "agent_slug": "a"},
        {"id": "task-term", "name": "Term", "slug": "term", "type": "terminal", "enabled": True},
    ])
    manager = RouteFakeManager(store)
    app = routes.build_routes(RouteFakeCtx(), store, manager)
    with TestClient(app) as c:
        c.manager = manager
        yield c


def test_run_route_passes_params_and_env_through(route_client):
    resp = route_client.post("/tasks/task-agentic/run",
                             json={"params": {"MSG": "hi"}, "env": {"CALLBACK_URL": "x"}})
    assert resp.status_code == 200
    assert route_client.manager.calls == [
        {"task_id": "task-agentic", "params": {"MSG": "hi"}, "env": {"CALLBACK_URL": "x"}}
    ]


def test_run_route_with_no_body_at_all_still_works(route_client):
    resp = route_client.post("/tasks/task-agentic/run")
    assert resp.status_code == 200
    assert route_client.manager.calls == [
        {"task_id": "task-agentic", "params": {}, "env": {}}
    ]


def test_run_route_rejects_a_bad_env_key(route_client):
    resp = route_client.post("/tasks/task-agentic/run", json={"env": {"PATH": "/evil"}})
    assert resp.status_code == 400
    assert "PATH" in resp.json()["detail"]
    assert route_client.manager.calls == []


def test_run_route_rejects_env_for_a_terminal_task(route_client):
    resp = route_client.post("/tasks/task-term/run", json={"env": {"FOO": "bar"}})
    assert resp.status_code == 400
    assert "terminal" in resp.json()["detail"]
    assert route_client.manager.calls == []


def test_run_by_slug_route_passes_params_through(route_client):
    resp = route_client.post("/tasks/by-slug/check/run", json={"params": {"MSG": "hi"}})
    assert resp.status_code == 200
    assert route_client.manager.calls == [
        {"task_id": "task-agentic", "params": {"MSG": "hi"}, "env": {}}
    ]


def test_run_by_slug_route_rejects_a_bad_params_key(route_client):
    resp = route_client.post("/tasks/by-slug/check/run", json={"params": {"1bad": "x"}})
    assert resp.status_code == 400
    assert route_client.manager.calls == []


# ── MCP run_task tool: params/env validation shared with REST ──────────────


class McpFakeStore:
    def __init__(self, tasks):
        self.tasks = {t["id"]: t for t in tasks}

    def get(self, task_id):
        return self.tasks.get(task_id)

    def get_by_slug(self, slug):
        for t in self.tasks.values():
            if t.get("slug") == slug:
                return t
        return None

    def runs_for(self, task_id, limit=10):
        return []


class McpFakeManager:
    def __init__(self, store):
        self.store = store
        self.calls = []

    async def start_task(self, task_id, *, trigger="manual", params=None, env=None):
        self.calls.append({"task_id": task_id, "params": params, "env": env})
        return {"id": "run-1", "task_id": task_id, "status": "running",
                "trigger": trigger, "params": params or {}, "env": env or {}}


class McpFakeCtx:
    config: dict = {}


def call_mcp(store, manager, args):
    return asyncio.get_event_loop().run_until_complete(
        http_handler.handle_request(
            {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
             "params": {"name": "run_task", "arguments": args}},
            ctx=McpFakeCtx(), store=store, manager=manager,
        )
    )


def test_mcp_run_task_passes_params_and_env_through():
    store = McpFakeStore([{"id": "task-1", "type": "agentic_output", "command": "x"}])
    manager = McpFakeManager(store)
    resp = call_mcp(store, manager, {"task_id": "task-1",
                                     "params": {"X": "1"}, "env": {"Y": "2"}})
    assert resp["result"]["isError"] is False
    assert manager.calls == [{"task_id": "task-1", "params": {"X": "1"}, "env": {"Y": "2"}}]


def test_mcp_run_task_rejects_env_for_a_terminal_task():
    store = McpFakeStore([{"id": "task-1", "type": "terminal"}])
    manager = McpFakeManager(store)
    resp = call_mcp(store, manager, {"task_id": "task-1", "env": {"FOO": "bar"}})
    assert resp["result"]["isError"] is True
    assert manager.calls == []


def test_mcp_run_task_rejects_a_denylisted_env_key():
    store = McpFakeStore([{"id": "task-1", "type": "agentic_output"}])
    manager = McpFakeManager(store)
    resp = call_mcp(store, manager, {"task_id": "task-1", "env": {"LD_PRELOAD": "/evil.so"}})
    assert resp["result"]["isError"] is True
    assert manager.calls == []


def test_mcp_run_task_unknown_task_is_an_error_before_validation_runs():
    store = McpFakeStore([])
    manager = McpFakeManager(store)
    resp = call_mcp(store, manager, {"task_id": "task-nope", "params": {"X": "1"}})
    assert resp["result"]["isError"] is True
    assert "not found" in resp["result"]["content"][0]["text"]
    assert manager.calls == []
