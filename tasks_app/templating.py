"""``{{params.KEY}}`` substitution into a task's prompt/command — see
``validation.py`` for what counts as a valid ``params`` dict in the first
place.

Unknown placeholder = run error, not silent empty: a cron-fired task that
references a param nobody will ever supply (the scheduler never passes any)
must fail loudly rather than quietly running with the literal text stripped
out. ``{{params.KEY|default}}`` is the escape hatch for exactly that case —
a task can declare its own fallback inline instead of needing a second
per-task config surface for defaults.
"""
from __future__ import annotations

import re

_PLACEHOLDER_RE = re.compile(
    r"\{\{\s*params\.([A-Za-z_][A-Za-z0-9_]*)\s*(?:\|([^}]*))?\s*\}\}"
)


def render(text: str, params: dict) -> tuple[str, str | None]:
    """``(rendered text, None)`` or ``(original text, error)``.

    Every ``{{params.KEY}}`` / ``{{params.KEY|default}}`` placeholder in
    ``text`` is substituted from ``params``, falling back to the inline
    default when the pipe form is used and the key is absent. A placeholder
    with no matching param and no default is a hard error.
    """
    if not text or "{{params." not in text:
        return text, None

    missing: list[str] = []

    def _sub(m: re.Match) -> str:
        key, default = m.group(1), m.group(2)
        if key in params:
            return str(params[key])
        if default is not None:
            return default
        missing.append(key)
        return m.group(0)

    rendered = _PLACEHOLDER_RE.sub(_sub, text)
    if missing:
        return text, (
            "unknown params placeholder(s) with no default: "
            f"{', '.join(sorted(set(missing)))}"
        )
    return rendered, None
