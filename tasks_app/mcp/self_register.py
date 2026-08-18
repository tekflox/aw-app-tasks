"""Write this app's own ``mcp.json`` so aw-mcp-gateway's app-scan
(``scan_app_mcp_servers()``, reading ``<installed-app-dir>/mcp.json``)
discovers the ``/mcp`` endpoint (``http_handler.py``) without any manual
wiring — copied from ``aw-app-whiteboard``'s ``whiteboard_app/mcp/
self_register.py``, which is the Tier-1 (in-process) version of the same
mechanism ``aw-app-kb`` uses for a Tier-2 (container) app.

Declaring ``contributes.mcp`` in the manifest is NOT what makes the tools
appear — that block is the marketplace's "what you get" list plus the
``reload_on_save`` hint. The gateway only ever finds an upstream by scanning
for this file. An app that declares the block and never writes the file ships
with MCP on the tin and zero tools served; that is exactly how
``aw-app-remote-host-cli`` ended up, and how this app shipped from v0.1.0
through v0.16.3.

Tier-1 specifics, both inherited from the whiteboard version:

* ``socket.gethostname()`` from inside the aw-workspace process is the same
  value ``ContainerSupervisor`` injects into sibling containers as
  ``AW_WORKSPACE_HOST`` (``src/apps/containers.py``), so it is the name the
  gateway's own container can actually reach us by. ``127.0.0.1`` would
  resolve inside the gateway's netns, not ours.
* Tier-1 routes sit behind IdentityGuard, so the entry carries an
  ``X-Api-Key`` header for aw-mcp-gateway's ``HttpUpstream`` to authenticate
  with (see ``docs/app-workspace-api-auth.md`` in ``aw-app-template``).
"""

from __future__ import annotations

import json
import logging
import os
import socket

log = logging.getLogger("aw_apps.tasks")

MCP_SERVER_NAME = "tasks"


def _mcp_json_path(package_dir: str) -> str:
    return os.path.join(package_dir, "mcp.json")


def build_self_entry(port: int) -> dict:
    host = socket.gethostname()
    entry: dict = {
        "type": "http",
        "url": f"http://{host}:{port}/api/apps/tasks/mcp",
        "enabled": True,
    }
    api_key = os.environ.get("AW_WORKSPACE_API_KEY")
    if api_key:
        entry["headers"] = {"X-Api-Key": api_key}
    return entry


def register_self(package_dir: str, port: int) -> None:
    """Best-effort; a bare dev run with no package_dir on a scanned root
    simply no-ops (nothing to write into, nothing breaks)."""
    if not os.path.isdir(package_dir):
        return

    entry = build_self_entry(port)
    path = _mcp_json_path(package_dir)
    data: dict = {"mcpServers": {}}
    try:
        with open(path) as f:
            existing = json.load(f)
        if isinstance(existing, dict) and isinstance(existing.get("mcpServers"), dict):
            data = existing
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    if data["mcpServers"].get(MCP_SERVER_NAME) == entry:
        return
    data["mcpServers"][MCP_SERVER_NAME] = entry
    try:
        tmp = f"{path}.tmp"
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, path)
        log.info("registered self as %r in %s (%s)", MCP_SERVER_NAME, path, entry["url"])
    except OSError as e:
        log.warning("could not write %s: %s", path, e)
