"""Multi-schedule support — ported verbatim (logic-for-logic) from the aw
monolith's ``src/api/task_manager.py`` (the ``_schedule_to_cron`` /
``_next_fire_for_schedule`` / ``_compute_next_fire`` / ``validate_schedule``
family + the ``once``/``daily``/``weekly``/``monthly``/``cron`` schedule
kinds). This module has zero framework/``ctx`` dependency — it is pure
function logic, so it ports byte-for-byte instead of needing adaptation.

A *schedule* is one of:
    {kind: "once",    at: "<ISO datetime>"}                     (one-shot)
    {kind: "daily",   time: "HH:MM"}
    {kind: "weekly",  days: [0..6], time: "HH:MM"}               (0 = Mon)
    {kind: "monthly", day_of_month: 1..31, time: "HH:MM"}
    {kind: "cron",    expr: "<5-field cron>"}                    (advanced)

A task's ``next_fire_at`` is the minimum next-fire across every schedule in
its ``schedules`` list. After a ``once`` schedule fires it is dropped from
the list (see ``store.py``'s run-recording path, mirroring the monolith's
``TaskStore._record_run``).
"""
from __future__ import annotations

import logging
import time

logger = logging.getLogger("tasks_app.scheduling")


def now() -> float:
    return time.time()


def next_fire_from_cron(expr: str, base: float | None = None) -> float | None:
    """Compute the next fire-time (epoch seconds) after `base` for a cron expr.

    Returns None if the expression is invalid — callers treat that as
    "never fires" (the schedule is effectively disabled until fixed).
    """
    try:
        from croniter import croniter
    except ImportError:
        logger.error("croniter not installed; cron schedules disabled")
        return None
    try:
        base = base if base is not None else now()
        it = croniter(expr, base)
        return float(it.get_next(float))
    except Exception as e:
        logger.warning("Invalid cron expr %r: %s", expr, e)
        return None


# Day-of-week numbers for our `weekly.days` field. We use Mon=0..Sun=6 (the
# Python convention). croniter's `dow` field uses 0=Sun..6=Sat, so we map
# when emitting cron expressions.
def _weekly_to_cron_dow(day_idx: int) -> int:
    # Mon=0..Sun=6  →  cron 0=Sun..6=Sat:  (Mon=1..Sun=0)
    return (day_idx + 1) % 7


def _parse_hhmm(s: str) -> tuple[int, int] | None:
    if not isinstance(s, str):
        return None
    parts = s.split(":")
    if len(parts) != 2:
        return None
    try:
        h, m = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if not (0 <= h < 24 and 0 <= m < 60):
        return None
    return h, m


def schedule_to_cron(sched: dict) -> str | None:
    """Lower a UI-level schedule entry to a cron expression.

    Returns None for `once` (handled directly) and for invalid inputs.
    """
    kind = (sched or {}).get("kind")
    if kind == "cron":
        expr = (sched.get("expr") or "").strip()
        return expr or None
    if kind == "daily":
        hm = _parse_hhmm(sched.get("time") or "")
        if not hm:
            return None
        h, m = hm
        return f"{m} {h} * * *"
    if kind == "weekly":
        hm = _parse_hhmm(sched.get("time") or "")
        days = sched.get("days") or []
        if not hm or not isinstance(days, list) or not days:
            return None
        h, m = hm
        try:
            dows = sorted({_weekly_to_cron_dow(int(d)) for d in days if 0 <= int(d) <= 6})
        except (TypeError, ValueError):
            return None
        if not dows:
            return None
        return f"{m} {h} * * {','.join(str(d) for d in dows)}"
    if kind == "monthly":
        hm = _parse_hhmm(sched.get("time") or "")
        try:
            dom = int(sched.get("day_of_month"))
        except (TypeError, ValueError):
            return None
        if not hm or not (1 <= dom <= 31):
            return None
        h, m = hm
        return f"{m} {h} {dom} * *"
    return None


def next_fire_for_schedule(sched: dict, base: float | None = None) -> float | None:
    """Next fire-time (epoch seconds) for a single schedule entry, or None.

    `once` is special: returns the absolute timestamp if it's still in the
    future; otherwise None (caller is expected to remove fired one-shots).
    """
    base = base if base is not None else now()
    kind = (sched or {}).get("kind")
    if kind == "once":
        at = sched.get("at")
        if not at:
            return None
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(at)
            ts = dt.timestamp()
        except Exception:
            return None
        return ts if ts > base else None
    cron = schedule_to_cron(sched)
    if not cron:
        return None
    return next_fire_from_cron(cron, base)


def normalize_schedules(task: dict) -> list[dict]:
    """Canonical schedules list for a task, folding a legacy `cron` string."""
    schedules = task.get("schedules")
    if isinstance(schedules, list) and schedules:
        return schedules
    cron = (task.get("cron") or "").strip()
    if cron:
        return [{"kind": "cron", "expr": cron}]
    return []


def compute_next_fire(task: dict, base: float | None = None) -> float | None:
    """Min next-fire across all of a task's schedules. None = never fires."""
    base = base if base is not None else now()
    candidates = []
    for s in normalize_schedules(task):
        nf = next_fire_for_schedule(s, base)
        if nf is not None:
            candidates.append(nf)
    return min(candidates) if candidates else None


SCHEDULE_KINDS = ("once", "daily", "weekly", "monthly", "cron")


def validate_schedule(sched: dict) -> str | None:
    """Return None if valid, else a human-readable error string."""
    if not isinstance(sched, dict):
        return "schedule must be an object"
    kind = sched.get("kind")
    if kind == "once":
        at = sched.get("at")
        if not at:
            return "`once` requires an `at` ISO datetime"
        try:
            from datetime import datetime
            datetime.fromisoformat(at)
        except Exception:
            return f"invalid datetime: {at!r}"
        return None
    if kind in ("daily", "weekly", "monthly"):
        if not _parse_hhmm(sched.get("time") or ""):
            return f"`{kind}` requires `time` as HH:MM"
        if kind == "weekly":
            days = sched.get("days") or []
            if not isinstance(days, list) or not days:
                return "`weekly` requires non-empty `days` list (0=Mon..6=Sun)"
            for d in days:
                try:
                    if not (0 <= int(d) <= 6):
                        return f"day index out of range: {d!r}"
                except (TypeError, ValueError):
                    return f"day must be int: {d!r}"
        if kind == "monthly":
            try:
                dom = int(sched.get("day_of_month"))
            except (TypeError, ValueError):
                return "`monthly` requires integer `day_of_month`"
            if not (1 <= dom <= 31):
                return "`day_of_month` must be 1..31"
        if schedule_to_cron(sched) is None:
            return f"could not lower {kind} schedule to cron"
        return None
    if kind == "cron":
        expr = (sched.get("expr") or "").strip()
        if not expr:
            return "`cron` requires `expr`"
        if next_fire_from_cron(expr) is None:
            return f"invalid cron expression: {expr!r}"
        return None
    return f"unknown schedule kind: {kind!r}"
