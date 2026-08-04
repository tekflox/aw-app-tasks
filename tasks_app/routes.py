"""tasks_app's mode-agnostic FastAPI sub-app — ported from the aw monolith's
``src/api/routes/tasks.py`` (``TaskRoutes``) onto this app's own store +
manager. Endpoint paths drop the monolith's ``/api/tasks`` prefix (this
sub-app is mounted at ``/api/apps/tasks`` by ``ctx.routes.register``, ADR
Decision 2/6) but otherwise match 1:1:

    monolith                          this app
    GET    /api/tasks                 GET    /tasks
    POST   /api/tasks                 POST   /tasks
    GET    /api/tasks/{id}            GET    /tasks/{id}
    PUT    /api/tasks/{id}            PUT    /tasks/{id}
    DELETE /api/tasks/{id}            DELETE /tasks/{id}
    POST   /api/tasks/{id}/run        POST   /tasks/{id}/run
    POST   /api/tasks/validate-cron   POST   /validate-cron
    POST   /api/tasks/preview-sched.  POST   /preview-schedules
                                       GET    /ui   (vanilla-JS view, see view.py)

``open_task`` (resolve+open the bound agent conversation) is not ported —
it depended on the monolith's agent-session-id capture machinery, which this
app does not reproduce (see manager.py's module docstring).
"""
from __future__ import annotations

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import HTMLResponse

from . import agents_platform_client, scheduling
from .manager import TaskManager
from .store import TaskStore
from .view import build_view_html


def build_routes(ctx, store: TaskStore, manager: TaskManager) -> FastAPI:
    api = FastAPI(title="tasks")

    @api.get("/agents")
    async def list_agents():
        cfg = ctx.config or {}
        base = cfg.get("agents_platform_base")
        token = cfg.get("agents_platform_token")
        if not base or not token:
            return {"ap_agents": []}
        agents = await agents_platform_client.list_agents(base=base, token=token)
        return {"ap_agents": agents}

    @api.get("/tasks")
    async def list_tasks():
        return {"tasks": store.list()}

    @api.post("/tasks")
    async def create_task(data: dict = Body(...)):
        name = (data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="name is required")
        task_type = (data.get("type") or "terminal").strip()
        cli_type = (data.get("cli_type") or "terminal").strip() if task_type == "terminal" else "terminal"
        command = data.get("command") or None
        if task_type == "agentic_output" and not command:
            raise HTTPException(status_code=400, detail="command is required for agentic_output")
        agent_slug = (data.get("agent_slug") or "").strip() or None
        if task_type in ("agent_prompt", "agentic_output") and not agent_slug:
            raise HTTPException(status_code=400, detail=f"agent_slug is required for {task_type}")

        schedules = data.get("schedules") or []
        if not isinstance(schedules, list):
            raise HTTPException(status_code=400, detail="schedules must be a list")
        for i, s in enumerate(schedules):
            err = scheduling.validate_schedule(s)
            if err:
                raise HTTPException(status_code=400, detail=f"schedules[{i}]: {err}")

        task = store.create(
            name=name, type=task_type, cli_type=cli_type,
            prompt=data.get("prompt") or "", command=command,
            notify_exit_codes=data.get("notify_exit_codes"),
            schedules=schedules, enabled=bool(data.get("enabled", True)),
            agent_slug=agent_slug, reuse_session=bool(data.get("reuse_session", False)),
        )
        return task

    @api.get("/tasks/{task_id}")
    async def get_task(task_id: str):
        t = store.get(task_id)
        if not t:
            raise HTTPException(status_code=404, detail="Not found")
        return t

    @api.put("/tasks/{task_id}")
    async def update_task(task_id: str, data: dict = Body(...)):
        existing = store.get(task_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Not found")
        if "schedules" in data:
            scheds = data["schedules"]
            if not isinstance(scheds, list):
                raise HTTPException(status_code=400, detail="schedules must be a list")
            for i, s in enumerate(scheds):
                err = scheduling.validate_schedule(s)
                if err:
                    raise HTTPException(status_code=400, detail=f"schedules[{i}]: {err}")
        updated = store.update(task_id, data)
        return updated

    @api.delete("/tasks/{task_id}")
    async def delete_task(task_id: str):
        ok = store.delete(task_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Not found")
        return {"success": True}

    @api.post("/tasks/{task_id}/run")
    async def run_task(task_id: str):
        try:
            run = await manager.run_task(task_id, trigger="manual")
        except KeyError:
            raise HTTPException(status_code=404, detail="Not found")
        return {"success": True, "run": run}

    @api.post("/validate-cron")
    async def validate_cron(data: dict = Body(...)):
        cron = (data.get("cron") or "").strip()
        if not cron:
            return {"ok": False, "error": "Empty cron"}
        nf = scheduling.next_fire_from_cron(cron)
        if nf is None:
            return {"ok": False, "error": f"Invalid cron expression: {cron!r}"}
        return {"ok": True, "next_fire_at": nf}

    @api.post("/preview-schedules")
    async def preview_schedules(data: dict = Body(...)):
        schedules = data.get("schedules") or []
        if not isinstance(schedules, list):
            return {"ok": False, "error": "schedules must be a list"}
        per_entry = []
        for i, s in enumerate(schedules):
            err = scheduling.validate_schedule(s)
            if err:
                per_entry.append({"index": i, "ok": False, "error": err})
                continue
            nf = scheduling.next_fire_for_schedule(s)
            per_entry.append({"index": i, "ok": True, "next_fire_at": nf})
        valid_fires = [e["next_fire_at"] for e in per_entry
                       if e.get("ok") and e.get("next_fire_at") is not None]
        return {
            "ok": all(e.get("ok") for e in per_entry),
            "entries": per_entry,
            "next_fire_at": min(valid_fires) if valid_fires else None,
        }

    @api.get("/ui")
    async def ui():
        return HTMLResponse(content=build_view_html())

    return api
