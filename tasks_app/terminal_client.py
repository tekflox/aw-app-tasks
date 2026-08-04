"""Best-effort client for the workspace's own terminals API — backs the
``terminal`` task type (fire a prompt into a reusable CLI session).

The monolith's ``task_manager.py`` (``ensure_task_session``/``run_task``)
imports ``TerminalManager`` directly and calls ``session.write(...)`` in the
same process. Apps cannot do that — "Terminals (PTY shell)" stays a **core**
surface per the migration roadmap (not its own app), so this app reaches it
the same way ``aw-app-whiteboard``/``aw-app-presentations`` reach other
core/app HTTP surfaces they don't own: an HTTP call (``net:outbound``)
against ``config.terminals_api_base``.

**Not verified against a live core terminals API** — this workspace's core
runtime source isn't checked out anywhere this app could read it from, so
the exact request/response shape below (``POST {base}/api/terminals`` ->
``{"id": ...}``, ``POST {base}/api/terminals/{id}/write`` with
``{"data": ...}``) is a best-effort guess mirroring the monolith's
``TerminalManager.create``/``session.write`` semantics, not a confirmed
contract. A human should double-check this against the real core terminals
API and adjust the two request shapes in this file if they differ — that is
the single biggest "port faithfully" gap in this app. Every call here is
wrapped so a wrong/missing endpoint degrades to a clear error on the task's
run row instead of crashing the scheduler.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("tasks_app.terminal_client")


class TerminalApiError(RuntimeError):
    pass


async def ensure_session(base_url: str, *, name: str, command: str,
                         session_id: str | None, timeout: float = 15.0) -> str:
    """Reuse ``session_id`` if still alive, else create a new terminal
    session named ``name`` running ``command``. Returns the session id."""
    import httpx

    async with httpx.AsyncClient(timeout=timeout) as client:
        if session_id:
            try:
                resp = await client.get(f"{base_url}/api/terminals/{session_id}")
                if resp.status_code == 200 and (resp.json() or {}).get("alive", True):
                    return session_id
            except httpx.HTTPError:
                pass  # fall through to create a fresh one

        try:
            resp = await client.post(
                f"{base_url}/api/terminals",
                json={"name": name, "command": command, "session_type": "terminal"},
            )
        except httpx.HTTPError as e:
            raise TerminalApiError(f"could not reach terminals API at {base_url}: {e}") from e
        if resp.status_code >= 300:
            raise TerminalApiError(
                f"terminals API POST /api/terminals -> {resp.status_code}: {resp.text[:300]}"
            )
        body = resp.json()
        sid = body.get("id") or body.get("session_id")
        if not sid:
            raise TerminalApiError(f"terminals API did not return a session id: {body!r}")
        return sid


async def write_prompt(base_url: str, session_id: str, prompt: str,
                       timeout: float = 15.0) -> None:
    """Write ``prompt`` followed by Enter into the given session."""
    import httpx

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(
                f"{base_url}/api/terminals/{session_id}/write",
                json={"data": prompt.rstrip() + "\r"},
            )
        except httpx.HTTPError as e:
            raise TerminalApiError(f"could not write to session {session_id}: {e}") from e
        if resp.status_code >= 300:
            raise TerminalApiError(
                f"terminals API POST /write -> {resp.status_code}: {resp.text[:300]}"
            )
