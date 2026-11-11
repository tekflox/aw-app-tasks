"""Turning a caller's task payload into ``TaskStore.create``/``update``
kwargs, with the checks that stop a *dead* task being created.

This lives apart from ``routes.py`` because there are now two front doors —
the REST surface and the MCP surface (``mcp/http_handler.py``) — and the one
thing they must never disagree about is what counts as a valid task. The
guard that matters most is ``agent_slug``: an ``agent_prompt`` or
``agentic_output`` task without one is accepted by the database, shows up in
the UI looking healthy, and can never dispatch to anything. That was a real
incident (see the ``agentic-output-tasks-need-agent-slug`` lesson), and the
fix is to refuse it at the door on *every* door, with a message that says
what to pass instead.
"""
from __future__ import annotations

import re

from . import scheduling

# The task types whose whole job is to hand work to an Agents Platform agent.
AGENT_BACKED_TYPES = ("agent_prompt", "agentic_output")

KNOWN_TYPES = ("terminal", "agentic_output", "agent_prompt")

_NO_SLUG = (
    "agent_slug is required for a {type!r} task. Without it the row is "
    "created but can never dispatch — the schedule fires and nothing "
    "happens. Pass the slug of an Agents Platform agent; `list_clis` "
    "returns the ones this workspace can reach."
)

# Same shape aw-workspace core enforces for contributes.agents[].slug
# (src/apps/manifest.py's SLUG_RE) — one convention across the workspace for
# what a "slug" looks like, rather than a tasks-specific one nobody expects.
_SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{1,40}$")


def normalize_slug(raw) -> tuple[str | None, str | None]:
    """``(normalized slug or None, error)``.

    Blank/absent clears the slug — a task's stable identifier is optional,
    not every task needs one. A non-blank value must match ``_SLUG_RE``;
    whoever calls this (``TaskStore`` for the uniqueness half, below) still
    has to check it isn't already owned by another task.
    """
    slug = str(raw or "").strip()
    if not slug:
        return None, None
    if not _SLUG_RE.match(slug):
        return None, (
            f"slug {slug!r} must start with a lowercase letter and contain "
            "only lowercase letters, digits and hyphens (2-41 chars total)"
        )
    return slug, None


# ----------------------------------------------------------------------
# run-time params + env passthrough (POST .../run, run_task MCP tool)
#
# Shared by both front doors for the same reason agent_slug validation is:
# the HTTP route and the MCP tool call TaskManager directly, so whichever one
# is laxer becomes the real contract. Bounded count/size so a caller can't
# blow up a run row or a shell command line; params values stay typed (they
# get stringified only at {{params.KEY}} substitution time), env values are
# coerced to str because an environment variable is always one.
# ----------------------------------------------------------------------

MAX_PARAMS = 20
MAX_ENV_VARS = 20
_MAX_KEY_LEN = 64
_MAX_VALUE_LEN = 4096

_PARAM_KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
_ENV_KEY_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")

# Tasks already run arbitrary commands under the caller's own auth, so taking
# an env var from the caller is not a new privilege — but silently letting a
# run mutate an EXISTING task's runtime via one of these would be, so they
# stay refused regardless of caller intent.
_ENV_DENYLIST_EXACT = frozenset({"PATH", "HOME", "SHELL"})
_ENV_DENYLIST_PREFIXES = ("LD_", "PYTHON", "AW_")


def _env_is_denied(key: str) -> bool:
    return key in _ENV_DENYLIST_EXACT or key.startswith(_ENV_DENYLIST_PREFIXES)


def validate_params(params) -> tuple[dict | None, str | None]:
    """``(normalized params or {}, None)`` or ``(None, error)``.

    Keys ``^[A-Za-z][A-Za-z0-9_]*$``, values str|int|float|bool — these are
    substituted as text into a prompt/command, so there is no reason to carry
    a nested structure through. Not a secrets channel: params are recorded
    verbatim on the run row (see store.py's runs table) so a run is
    reproducible from its own history.
    """
    if params is None:
        return {}, None
    if not isinstance(params, dict):
        return None, "params must be an object"
    if len(params) > MAX_PARAMS:
        return None, f"params: at most {MAX_PARAMS} entries, got {len(params)}"
    out: dict = {}
    for key, value in params.items():
        if not isinstance(key, str) or not _PARAM_KEY_RE.match(key):
            return None, f"params key {key!r} must match {_PARAM_KEY_RE.pattern}"
        if len(key) > _MAX_KEY_LEN:
            return None, f"params key {key!r} exceeds {_MAX_KEY_LEN} chars"
        if not isinstance(value, (str, int, float, bool)):
            return None, f"params[{key!r}] must be a string, number or boolean"
        if isinstance(value, str) and len(value) > _MAX_VALUE_LEN:
            return None, f"params[{key!r}] exceeds {_MAX_VALUE_LEN} chars"
        out[key] = value
    return out, None


def validate_env(env, *, task_type: str) -> tuple[dict | None, str | None]:
    """``(normalized env or {}, None)`` or ``(None, error)``.

    Keys ``^[A-Z][A-Z0-9_]*$``, refused on the reserved denylist (PATH, HOME,
    SHELL, LD_*, PYTHON*, AW_*). A ``terminal`` task's reused PTY has its
    environment fixed at session creation — env is refused outright for that
    type rather than silently doing nothing.
    """
    if env is None:
        return {}, None
    if not isinstance(env, dict):
        return None, "env must be an object"
    if task_type == "terminal":
        if env:
            return None, (
                "env is not supported for 'terminal' tasks — a reused CLI "
                "session's environment is fixed when the session is first "
                "created and cannot be changed per run. Use params instead."
            )
        return {}, None
    if len(env) > MAX_ENV_VARS:
        return None, f"env: at most {MAX_ENV_VARS} entries, got {len(env)}"
    out: dict = {}
    for key, value in env.items():
        if not isinstance(key, str) or not _ENV_KEY_RE.match(key):
            return None, f"env key {key!r} must match {_ENV_KEY_RE.pattern}"
        if len(key) > _MAX_KEY_LEN:
            return None, f"env key {key!r} exceeds {_MAX_KEY_LEN} chars"
        if _env_is_denied(key):
            return None, f"env key {key!r} is reserved and cannot be overridden"
        if not isinstance(value, (str, int, float, bool)):
            return None, f"env[{key!r}] must be a string, number or boolean"
        value = value if isinstance(value, str) else str(value)
        if len(value) > _MAX_VALUE_LEN:
            return None, f"env[{key!r}] exceeds {_MAX_VALUE_LEN} chars"
        out[key] = value
    return out, None


def validate_run_args(data: dict, *, task_type: str) -> tuple[dict, str | None]:
    """Normalize+validate an optional ``{"params": {...}, "env": {...}}``
    run body — shared by both run routes and the MCP ``run_task`` tool.

    Returns ``({"params": {...}, "env": {...}}, None)`` or ``({}, error)``.
    """
    params, err = validate_params((data or {}).get("params"))
    if err:
        return {}, err
    env, err = validate_env((data or {}).get("env"), task_type=task_type)
    if err:
        return {}, err
    return {"params": params, "env": env}, None


def validate_schedules(schedules) -> str | None:
    """None if every entry is a schedule the scheduler can compute a next
    fire from, else the first problem found."""
    if not isinstance(schedules, list):
        return "schedules must be a list"
    for i, s in enumerate(schedules):
        err = scheduling.validate_schedule(s)
        if err:
            return f"schedules[{i}]: {err}"
    return None


def normalize_create(data: dict) -> tuple[dict | None, str | None]:
    """``(kwargs for TaskStore.create, None)`` or ``(None, error message)``."""
    name = (data.get("name") or "").strip()
    if not name:
        return None, "name is required"

    task_type = (data.get("type") or "terminal").strip()
    if task_type not in KNOWN_TYPES:
        return None, (
            f"unknown task type {task_type!r} — one of "
            f"{', '.join(repr(t) for t in KNOWN_TYPES)}"
        )

    # cli_type only means anything to a `terminal` task; for the others the
    # column is carried at its default rather than echoing back a value that
    # would never be read.
    cli_type = (data.get("cli_type") or "terminal").strip() if task_type == "terminal" else "terminal"

    command = data.get("command") or None
    if task_type == "agentic_output" and not command:
        return None, "command is required for agentic_output"

    agent_slug = (data.get("agent_slug") or "").strip() or None
    if task_type in AGENT_BACKED_TYPES and not agent_slug:
        return None, _NO_SLUG.format(type=task_type)

    schedules = data.get("schedules") or []
    err = validate_schedules(schedules)
    if err:
        return None, err

    slug, err = normalize_slug(data.get("slug"))
    if err:
        return None, err

    return {
        "name": name,
        "type": task_type,
        "cli_type": cli_type,
        "prompt": data.get("prompt") or "",
        "command": command,
        "notify_exit_codes": data.get("notify_exit_codes"),
        "schedules": schedules,
        "enabled": bool(data.get("enabled", True)),
        "agent_slug": agent_slug,
        "reuse_session": bool(data.get("reuse_session", False)),
        "slug": slug,
    }, None


# Touching any of these can turn a working task into one that dispatches
# nowhere, so a patch that includes one gets the full creation check.
_DISPATCH_FIELDS = ("type", "agent_slug", "command")

# These two decide whether the scheduler will fire the task at all. A patch
# that touches either and leaves the task *enabled* is arming it, and arming a
# slug-less `agent_prompt` recreates the exact silent failure the guard exists
# to prevent — the schedule fires, nothing dispatches, the row still looks
# healthy. So arming earns the same check as editing dispatch itself.
_ARMING_FIELDS = ("enabled", "schedules")


def validate_patch(existing: dict, patch: dict) -> str | None:
    """None if applying ``patch`` to ``existing`` leaves a task that can still
    run, else the problem.

    Same slug rule as creation, checked against the *merged* result — flipping
    an existing terminal task to ``agent_prompt`` without naming an agent
    kills it exactly as thoroughly as creating it that way.

    Scoped to patches that touch dispatch (``_DISPATCH_FIELDS``) or arm the
    task (``_ARMING_FIELDS`` with the merged row left enabled). A workspace may
    already hold a slug-less ``agent_prompt`` row from before this check
    existed, and refusing every edit to it would leave no way to rename or even
    *disable* the thing — so renaming a broken task stays allowed, and so does
    turning it off. Making a task broken does not, and neither does switching a
    broken one on.
    """
    if "schedules" in patch:
        err = validate_schedules(patch["schedules"])
        if err:
            return err
    if "slug" in patch:
        _, err = normalize_slug(patch["slug"])
        if err:
            return err
    if not (any(f in patch for f in _DISPATCH_FIELDS) or _arms_the_task(existing, patch)):
        return None

    merged = {**existing, **patch}
    task_type = (merged.get("type") or "terminal").strip()
    if task_type not in KNOWN_TYPES:
        return (
            f"unknown task type {task_type!r} — one of "
            f"{', '.join(repr(t) for t in KNOWN_TYPES)}"
        )
    if task_type in AGENT_BACKED_TYPES and not (merged.get("agent_slug") or "").strip():
        return _NO_SLUG.format(type=task_type)
    if task_type == "agentic_output" and not (merged.get("command") or "").strip():
        return "command is required for agentic_output"
    return None


def _arms_the_task(existing: dict, patch: dict) -> bool:
    """True when the patch changes whether/when the scheduler fires this task
    and leaves it enabled.

    Turning a task *off* — or editing the schedules of one that stays off —
    isn't arming, which is what keeps an already-broken row disable-able.
    """
    if not any(f in patch for f in _ARMING_FIELDS):
        return False
    return bool({**existing, **patch}.get("enabled"))
