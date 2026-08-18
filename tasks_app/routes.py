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
                                       GET    /panel (vanilla-JS view, see view.py)
                                       POST   /mcp   (MCP over Streamable HTTP)

The MCP surface at ``/mcp`` re-exposes the monolith's ``src/mcp/tasks.py``
tools against the same store/manager these routes use — see
``mcp/http_handler.py``, and ``validation.py`` for the checks both share.
"""
from __future__ import annotations

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response

from . import agents_platform_client, scheduling, validation
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
        # Shared with the MCP surface (mcp/http_handler.py) so the two front
        # doors can't disagree about what a valid task is — see validation.py.
        kwargs, err = validation.normalize_create(data)
        if err:
            raise HTTPException(status_code=400, detail=err)
        return store.create(**kwargs)

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
        err = validation.validate_patch(existing, data)
        if err:
            raise HTTPException(status_code=400, detail=err)
        return store.update(task_id, data)

    @api.delete("/tasks/{task_id}")
    async def delete_task(task_id: str):
        ok = store.delete(task_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Not found")
        return {"success": True}

    @api.post("/tasks/{task_id}/run")
    async def run_task(task_id: str):
        # Returns as soon as the run is *started*, with the run row already
        # persisted as status="running" — see TaskManager.start_task for why
        # awaiting the whole run here is not survivable over HTTP.
        try:
            run = await manager.start_task(task_id, trigger="manual")
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

    # NOT "/ui": core serves GET /api/apps/{slug}/ui/{path:path} (component
    # bundles) and matches it BEFORE an app's Mount, so this route was
    # unreachable — refused at load since 2026-08-13, which kept the whole app
    # from installing.
    @api.get("/panel")
    async def ui():
        return HTMLResponse(content=build_view_html())

    # ------------------------------------------------------------------
    # MCP — Streamable HTTP, auto-discovered by aw-mcp-gateway's app-scan
    # (see mcp/self_register.py + mcp/http_handler.py). Behind the same
    # IdentityGuard as every other route here; the gateway authenticates with
    # the X-Api-Key that self_register writes into the entry.
    # ------------------------------------------------------------------

    @api.post("/mcp")
    async def mcp_post(data: dict | list = Body(...)):
        from .mcp.http_handler import handle_request as mcp_handle_request

        messages = data if isinstance(data, list) else [data]
        responses = []
        for m in messages:
            r = await mcp_handle_request(m, ctx=ctx, store=store, manager=manager)
            if r is not None:
                responses.append(r)
        if not responses:
            return Response(status_code=202)
        return JSONResponse(responses if isinstance(data, list) else responses[0])

    @api.get("/mcp")
    async def mcp_get():
        return Response(status_code=405)

    return api
