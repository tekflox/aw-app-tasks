"""``register_contributed_task`` — the provider side of contributes.tasks.

Driven with a fake store so these run without Postgres. What matters here is
which fields survive the hop from an app's manifest into ``store.create``:
a dropped one doesn't raise, it produces a task row that looks correct in the
Tasks UI and then misbehaves on a schedule nobody is watching.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app.plugin import TasksAppPlugin  # noqa: E402


class FakeStore:
    def __init__(self, existing=None):
        self.existing = list(existing or [])
        self.created: list[dict] = []

    def list(self):
        return self.existing

    def create(self, **kwargs):
        self.created.append(kwargs)
        return kwargs


@pytest.fixture
def plugin():
    p = TasksAppPlugin()
    p.store = FakeStore()
    return p


def test_agent_prompt_task_carries_its_agent_slug(plugin):
    """The regression this test exists for.

    Until 2026-08-13 the provider never passed agent_slug, so an app that
    shipped an agent AND the schedule driving it got a task row with a NULL
    slug — created successfully, reported as seeded, and unable to dispatch
    to anything for the rest of its life.
    """
    created = plugin.register_contributed_task("maintenance-agents", {
        "name": "System Analyst — daily audit",
        "type": "agent_prompt",
        "agent_slug": "system-analyst",
        "prompt": "Run the full daily audit.",
        "reuse_session": True,
        "schedules": [{"kind": "daily", "time": "06:00"}],
    })

    assert created is True
    row = plugin.store.created[0]
    assert row["agent_slug"] == "system-analyst"
    assert row["reuse_session"] is True
    assert row["type"] == "agent_prompt"


def test_absent_agent_slug_becomes_none_not_empty_string(plugin):
    # The column is nullable and read as "is there a target?"; "" would be
    # truthy-adjacent noise in that check.
    plugin.register_contributed_task("x", {"name": "T", "type": "agentic_output",
                                           "command": "echo hi"})
    assert plugin.store.created[0]["agent_slug"] is None
    assert plugin.store.created[0]["reuse_session"] is False


def test_blank_agent_slug_is_normalised_to_none(plugin):
    plugin.register_contributed_task("x", {"name": "T", "type": "agent_prompt",
                                           "prompt": "go", "agent_slug": "   "})
    assert plugin.store.created[0]["agent_slug"] is None


def test_an_existing_task_of_the_same_name_is_left_untouched(plugin):
    plugin.store = FakeStore(existing=[{"name": "System Analyst — daily audit",
                                        "enabled": True, "agent_slug": "mine"}])

    created = plugin.register_contributed_task("maintenance-agents", {
        "name": "System Analyst — daily audit",
        "type": "agent_prompt", "agent_slug": "system-analyst", "prompt": "x",
    })

    assert created is False
    assert plugin.store.created == []


def test_seeded_tasks_default_to_disabled(plugin):
    plugin.register_contributed_task("x", {"name": "T", "type": "agentic_output",
                                           "command": "echo"})
    assert plugin.store.created[0]["enabled"] is False


def test_notify_exit_codes_list_is_flattened_to_a_comma_string(plugin):
    plugin.register_contributed_task("x", {"name": "T", "type": "agentic_output",
                                           "command": "echo",
                                           "notify_exit_codes": [1, 2]})
    assert plugin.store.created[0]["notify_exit_codes"] == "1,2"


def test_a_nameless_declaration_is_refused(plugin):
    assert plugin.register_contributed_task("x", {"type": "agentic_output"}) is False
    assert plugin.store.created == []
