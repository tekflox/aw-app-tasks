"""The REST half of task slugs: ``/tasks/by-slug/{slug}`` + its ``/run``, and
that a slug conflict on the ordinary create/update routes comes back as a
clean 400 instead of an unhandled 500.

Driven with a fake store/manager, same spirit as ``test_mcp_surface.py`` —
what matters here is the HTTP contract, not TaskStore's own SQL.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tasks_app import routes  # noqa: E402
from tasks_app.store import SlugConflict  # noqa: E402


class FakeStore:
    def __init__(self, tasks=None):
        self.tasks = {t["id"]: t for t in (tasks or [])}
        self.created: list[dict] = []

    def list(self):
        return list(self.tasks.values())

    def get(self, task_id):
        return self.tasks.get(task_id)

    def get_by_slug(self, slug):
        for t in self.tasks.values():
            if t.get("slug") == slug and not t.get("hidden"):
                return t
        return None

    def create(self, **kwargs):
        slug = kwargs.get("slug")
        if slug and any(t.get("slug") == slug for t in self.tasks.values()):
            raise SlugConflict(slug, "task-existing")
        self.created.append(kwargs)
        row = {"id": "task-new", "runs": [], **kwargs}
        self.tasks[row["id"]] = row
        return row

    def update(self, task_id, patch):
        slug = patch.get("slug")
        if slug and any(t.get("slug") == slug and tid != task_id
                        for tid, t in self.tasks.items()):
            raise SlugConflict(slug, "task-existing")
        self.tasks[task_id] = {**self.tasks[task_id], **patch}
        return self.tasks[task_id]

    def delete(self, task_id):
        return task_id in self.tasks


class FakeManager:
    def __init__(self, store):
        self.store = store
        self.started: list[str] = []
        self.started_with: list[dict] = []

    async def start_task(self, task_id, *, trigger="manual", params=None, env=None):
        if task_id not in self.store.tasks:
            raise KeyError(task_id)
        self.started.append(task_id)
        self.started_with.append({"params": params or {}, "env": env or {}})
        return {"id": "run-1", "task_id": task_id, "status": "running", "trigger": trigger,
                "params": params or {}, "env": env or {}}


class FakeCtx:
    config: dict = {}


@pytest.fixture
def client():
    store = FakeStore(tasks=[{
        "id": "task-abc", "name": "Nightly digest", "slug": "nightly-digest",
        "type": "terminal", "enabled": True, "runs": [],
    }, {
        "id": "task-existing", "name": "Other", "slug": "taken", "type": "terminal",
        "enabled": True, "runs": [],
    }])
    manager = FakeManager(store)
    app = routes.build_routes(FakeCtx(), store, manager)
    with TestClient(app) as c:
        c.store = store
        c.manager = manager
        yield c


def test_get_task_by_slug(client):
    resp = client.get("/tasks/by-slug/nightly-digest")
    assert resp.status_code == 200
    assert resp.json()["id"] == "task-abc"


def test_get_task_by_unknown_slug_is_404(client):
    resp = client.get("/tasks/by-slug/nope")
    assert resp.status_code == 404


def test_run_task_by_slug_starts_the_right_task(client):
    resp = client.post("/tasks/by-slug/nightly-digest/run")
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert client.manager.started == ["task-abc"]


def test_run_task_by_unknown_slug_is_404(client):
    resp = client.post("/tasks/by-slug/nope/run")
    assert resp.status_code == 404


def test_id_based_routes_are_unaffected_by_slug_routes(client):
    resp = client.get("/tasks/task-abc")
    assert resp.status_code == 200
    assert resp.json()["id"] == "task-abc"


def test_create_task_with_a_slug_already_taken_is_a_clean_400(client):
    resp = client.post("/tasks", json={"name": "Dup", "slug": "taken"})
    assert resp.status_code == 400
    assert "taken" in resp.json()["detail"]


def test_update_task_slug_conflict_is_a_clean_400(client):
    resp = client.put("/tasks/task-abc", json={"slug": "taken"})
    assert resp.status_code == 400
    assert "taken" in resp.json()["detail"]
