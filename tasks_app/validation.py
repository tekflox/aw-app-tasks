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
