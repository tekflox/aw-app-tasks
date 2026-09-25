"""Read a workspace-published env var, from this process or from the .env
the server mirrors it into (0600, written at boot).

Ported from ``aw-app-agents-platform-runners``'s ``platform_base.py::
workspace_env`` (same helper, same callers) — needed because
``AW_BACKEND_URL``/``AW_WORKSPACE``/``AW_WORKSPACE_HOST_TOKEN``/
``AW_WORKSPACE_API_URL``/``AW_WORKSPACE_API_KEY`` are not guaranteed on the
process env; only ``<AW_WORKSPACE_HOME>/.env`` is. ``terminal_client.py``'s
bare ``os.environ.get(API_KEY_ENV)`` is the shape to NOT copy — it works only
because core also sets that one key directly on Tier-1 processes, which is
not true for the five vars this module reads.
"""
from __future__ import annotations

import os


def workspace_env(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    home = os.environ.get("AW_WORKSPACE_HOME") or os.path.join(
        os.environ.get("AW_WORKSPACE_CONTAINER_DIR", "/opt/aw-workspace"), ".aw-workspace")
    try:
        with open(os.path.join(home, ".env"), "r", encoding="utf-8") as fh:
            for line in fh:
                if line.startswith(f"{name}="):
                    return line.split("=", 1)[1].strip()
    except OSError:
        pass
    return ""
