"""Client for calling an Agents Platform (``agents-platform-multitenant``)
agent with a prompt — backs the ``agent_prompt`` task type.

Ported from the monolith's ``task_manager.py`` (``TaskManager._ap_agent_run``,
which called the legacy single-tenant instance at ``localhost:10005`` in the
same process' network namespace — not reachable from inside a BYOD workspace
container). This app instead follows the pattern already established by
``aw-app-agents-platform-runners`` (``mcp_server.py``'s ``BASE``/
``AUTH_HEADERS``): a configured base URL + a bearer identity JWT, since
``agents-platform-multitenant``'s ``require_identity()`` rejects
unauthenticated requests.

Endpoints used (see ``agents-platform-multitenant/backend/app/api/agents.py``
and ``api/runs.py``):

* ``POST {base}/api/agents/{slug}/run`` — start a run, body
  ``{"input": {"input": <prompt>}, "target_slug": <target>, "session_id"?}``.
  Returns ``{"run_id": ..., "target_id": ...}``.
* ``GET {base}/api/runs/{run_id}/wait?timeout_s=N`` — server-side long-poll
  until the run reaches a terminal status. Returns the full ``RunOut``
  (``status``, ``output: {"text": ...}``, ``error``, ``session_id``).
"""
from __future__ import annotations

import httpx

DEFAULT_TIMEOUT_S = 1800


class AgentsPlatformError(RuntimeError):
    pass


async def list_agents(*, base: str, token: str) -> list[dict]:
    """``GET {base}/api/agents`` — used to populate the agent picker in the
    Tasks UI. Returns an empty list (rather than raising) on any failure so
    a misconfigured/unreachable Agents Platform degrades to an empty
    dropdown instead of breaking the whole dialog."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        async with httpx.AsyncClient(base_url=base, headers=headers, timeout=10) as c:
            r = await c.get("/api/agents")
        if r.status_code != 200:
            return []
        data = r.json()
        agents = data.get("agents", data) if isinstance(data, dict) else data
        return [
            {"slug": a.get("slug"), "name": a.get("name")}
            for a in agents if isinstance(a, dict) and a.get("slug")
        ]
    except httpx.HTTPError:
        return []


async def run_agent(
    *, base: str, token: str, slug: str, prompt: str,
    target_slug: str = "adhoc", session_id: str | None = None,
    timeout_s: int = DEFAULT_TIMEOUT_S,
) -> dict:
    """Start an agent run and block until it finishes.

    Returns ``{"run_id", "text", "session_id", "is_error", "error"}``.
    """
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    body: dict = {"input": {"input": prompt}, "target_slug": target_slug}
    if session_id:
        body["session_id"] = session_id

    async with httpx.AsyncClient(base_url=base, headers=headers, timeout=30) as c:
        try:
            r = await c.post(f"/api/agents/{slug}/run", json=body)
        except httpx.HTTPError as e:
            raise AgentsPlatformError(f"failed to start run: {e}") from e
        if r.status_code != 200:
            raise AgentsPlatformError(
                f"failed to start run: HTTP {r.status_code} {r.text[:500]}")
        run_id = r.json().get("run_id")
        if not run_id:
            raise AgentsPlatformError(f"no run_id in response: {r.text[:500]}")

        try:
            wr = await c.get(
                f"/api/runs/{run_id}/wait", params={"timeout_s": str(timeout_s)},
                timeout=timeout_s + 30,
            )
        except httpx.HTTPError as e:
            raise AgentsPlatformError(f"failed to wait for run {run_id}: {e}") from e
        if wr.status_code != 200:
            raise AgentsPlatformError(
                f"failed to wait for run {run_id}: HTTP {wr.status_code} {wr.text[:500]}")
        run = wr.json()

    status = run.get("status")
    output = run.get("output") or {}
    text = output.get("text") if isinstance(output, dict) else None
    is_error = status not in ("success",)
    return {
        "run_id": run_id,
        "text": text if text is not None else (run.get("error") or f"run ended with status={status!r}"),
        "session_id": run.get("session_id"),
        "is_error": is_error,
        "error": run.get("error"),
    }
