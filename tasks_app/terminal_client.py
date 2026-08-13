"""Best-effort client for the workspace's own terminals API — backs the
``terminal`` task type (fire a prompt into a reusable CLI session).

The monolith's ``task_manager.py`` (``ensure_task_session``/``run_task``)
imports ``TerminalManager`` directly and calls ``session.write(...)`` in the
same process. Apps cannot do that — "Terminals (PTY shell)" stays a **core**
surface per the migration roadmap (not its own app), so this app reaches it
the same way ``aw-app-whiteboard``/``aw-app-presentations`` reach other
core/app HTTP surfaces they don't own: an HTTP call (``net:outbound``)
against ``config.terminals_api_base``.

**Verified against core 2026-08-13** (``src/api/terminal.py`` +
``terminal_manager.py``). The original port was written blind and guessed
this contract wrong in three places — every one of them fixed here:

* **Auth.** Every ``/api/terminals*`` route is ``Depends(require_identity)``.
  The old client sent no header at all, so a correctly-configured
  ``terminals_api_base`` would only ever have produced 401s. We send the
  workspace-wide ``X-Api-Key``; ``require_identity`` accepts it
  (``src/api/identity.py::_workspace_api_key_authorized``). Reading
  ``AW_WORKSPACE_API_KEY`` from the environment is the one blessed exception
  to "apps must not reach into core" — see the module docstring of
  ``src/api/workspace_api_key.py``, which sets it on ``os.environ`` for
  in-process Tier-1 apps precisely so this works.
* **Write body.** Core reads ``data.get("text", "")``; the old client sent
  ``{"data": ...}``. That failed *silently* — core writes nothing and still
  returns ``{"success": True}``, so a task would report ok having done
  nothing. We send ``{"text": ..., "send_enter": True}``.
* **Session reuse.** There is no ``GET /api/terminals/{id}`` route (core has
  list/create/upload/rename/restart/delete/write/scrollback/procs). The old
  reuse probe therefore always missed and leaked a fresh PTY per fire. We
  filter the ``GET /api/terminals`` list instead.

Also: core's create reads ``data["type"]``, not ``session_type``.

Every call here is wrapped so a wrong/missing endpoint degrades to a clear
error on the task's run row instead of crashing the scheduler.
"""
from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger("tasks_app.terminal_client")

#: Set on ``os.environ`` by core for in-process apps — see module docstring.
API_KEY_ENV = "AW_WORKSPACE_API_KEY"

#: A freshly forked PTY is still starting its login shell when create returns.
#: Core's own ``initial_prompt`` path sleeps 5s before writing for exactly this
#: reason; we write into the tty input queue (which buffers) so a shorter wait
#: is enough to keep the prompt off the pre-shell screen.
NEW_SESSION_SETTLE_S = 2.0


def _headers() -> dict:
    key = os.environ.get(API_KEY_ENV)
    if not key:
        logger.warning(
            "%s not set — terminals API calls will be rejected as unauthenticated",
            API_KEY_ENV,
        )
        return {}
    return {"X-Api-Key": key}


class TerminalApiError(RuntimeError):
    pass


async def ensure_session(base_url: str, *, name: str, command: str | None,
                         session_id: str | None, timeout: float = 15.0) -> str:
    """Reuse ``session_id`` if still alive, else create a new terminal
    session named ``name`` running ``command``. Returns the session id.

    ``command=None`` means a plain login shell — that is what a ``cli_type``
    of ``"terminal"`` wants. Passing the literal string ``"terminal"`` (as
    this app used to) makes core run ``bash -lc "cd …; terminal"``, i.e.
    command-not-found, and the PTY dies on the spot.
    """
    import httpx

    async with httpx.AsyncClient(timeout=timeout, headers=_headers()) as client:
        if session_id and await _is_alive(client, base_url, session_id):
            return session_id

        try:
            resp = await client.post(
                f"{base_url}/api/terminals",
                json={"name": name, "command": command, "type": "terminal"},
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

        await asyncio.sleep(NEW_SESSION_SETTLE_S)
        return sid


async def _is_alive(client, base_url: str, session_id: str) -> bool:
    """Is ``session_id`` still in core's session list?

    Core exposes no per-session GET, so we filter the list. It also prunes
    dead sessions on every ``list_sessions`` call, meaning absence from the
    list already means dead — the ``alive`` check is belt-and-braces.
    """
    import httpx

    try:
        resp = await client.get(f"{base_url}/api/terminals")
    except httpx.HTTPError:
        return False  # fall through to create a fresh one
    if resp.status_code >= 300:
        return False
    sessions = resp.json()
    if not isinstance(sessions, list):
        return False
    return any(s.get("id") == session_id and s.get("alive", True) for s in sessions)


async def write_prompt(base_url: str, session_id: str, prompt: str,
                       timeout: float = 15.0) -> None:
    """Write ``prompt`` followed by Enter into the given session."""
    import httpx

    async with httpx.AsyncClient(timeout=timeout, headers=_headers()) as client:
        try:
            resp = await client.post(
                f"{base_url}/api/terminals/{session_id}/write",
                json={"text": prompt.rstrip(), "send_enter": True},
            )
        except httpx.HTTPError as e:
            raise TerminalApiError(f"could not write to session {session_id}: {e}") from e
        if resp.status_code >= 300:
            raise TerminalApiError(
                f"terminals API POST /write -> {resp.status_code}: {resp.text[:300]}"
            )
