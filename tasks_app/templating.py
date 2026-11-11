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
import shlex

_PLACEHOLDER_RE = re.compile(
    r"\{\{\s*params\.([A-Za-z_][A-Za-z0-9_]*)\s*(?:\|([^}]*))?\s*\}\}"
)


def _as_text(value) -> str:
    # bool is an int subclass — str(True) is "True", which reads as a
    # shell/JSON-ish literal nowhere: render the convention every caller
    # actually expects instead of Python's repr.
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def render(text: str, params: dict, *, shell_quote: bool = False) -> tuple[str, str | None]:
    """``(rendered text, None)`` or ``(original text, error)``.

    Every ``{{params.KEY}}`` / ``{{params.KEY|default}}`` placeholder in
    ``text`` is substituted from ``params``, falling back to the inline
    default when the pipe form is used and the key is absent. A placeholder
    with no matching param and no default is a hard error.

    ``shell_quote=True`` wraps each substituted value through ``shlex.quote``
    before splicing it in — mandatory for a ``command`` that is later run via
    ``subprocess.run(..., shell=True)`` (``agentic_output``'s command): a
    param value is caller-supplied, caller-supplied text landing unescaped in
    a shell string is OS command injection (CWE-78), not a templating
    nicety. A ``prompt`` destined for an LLM agent, not a shell, must NOT be
    quoted — quoting is a shell-string property, not a generic templating
    one, so callers opt in per call site rather than this module guessing
    from the placeholder's name.
    """
    if not text or "{{params." not in text:
        return text, None

    missing: list[str] = []

    def _emit(s: str) -> str:
        return shlex.quote(s) if shell_quote else s

    def _sub(m: re.Match) -> str:
        key, default = m.group(1), m.group(2)
        if key in params:
            return _emit(_as_text(params[key]))
        if default is not None:
            return _emit(default)
        missing.append(key)
        return m.group(0)

    rendered = _PLACEHOLDER_RE.sub(_sub, text)
    if missing:
        return text, (
            "unknown params placeholder(s) with no default: "
            f"{', '.join(sorted(set(missing)))}"
        )
    return rendered, None
