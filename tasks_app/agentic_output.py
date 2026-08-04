"""agentic_output — run a cheap command; only make noise when the exit code
is notable.

Ported from the aw monolith's ``tools/agentic_output.py`` (the
:func:`run_command` / :func:`parse_notify_codes` / notable-exit-code policy
is identical) but the *delivery* mechanism is adapted for the decoupled-app
capability catalog:

* Monolith: POSTs to the Agents Platform's ``/api/telegram/inject`` so a
  Telegram bot's own agent reads the output and writes a human explanation
  into a chat. That needs an Agents Platform + Telegram bot dependency this
  app does not declare (the roadmap entry for Scheduled Tasks only lists
  ``watchdog``, ``db``, ``terminals API`` as framework deps — no Agents
  Platform/Telegram dep), so it isn't ported.
* Here: fires a workspace notification via ``ctx.notify`` (``notifications:
  send``) with the command, exit code, and truncated output — the user reads
  it in the notification tray instead of a bot chat. No LLM interpretation
  step (this module still does zero LLM calls, matching the original's
  "thin, deterministic wrapper" design goal); that's a deliberate scope cut
  a human should double-check if agent-authored interpretation of the output
  is actually wanted later — see the app README.

This is the engine behind the ``agentic_output`` task type in
``manager.py``. It is also usable standalone (no ``ctx``): call
:func:`run_command` + :func:`parse_notify_codes` directly.
"""
from __future__ import annotations

# Cap how much command output goes into a notification body, so a runaway
# log doesn't blow up the notification tray. Head + tail keeps the useful
# bits (matches the monolith's _MAX_OUTPUT_CHARS budget).
_MAX_OUTPUT_CHARS = 2000


def parse_notify_codes(spec: str | None) -> set[int] | None:
    """Parse a ``notify_exit_codes`` spec into a set of exit codes.

    Accepts:
      - ``None`` / "" / "nonzero"  → None, meaning "any non-zero code notifies"
      - ``"1,2,127"``              → {1, 2, 127}
      - ``"0"``                    → {0}   (notify only on success)
    """
    if spec is None:
        return None
    spec = spec.strip().lower()
    if spec in ("", "nonzero", "any", "*"):
        return None
    codes: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            codes.add(int(part))
        except ValueError:
            raise ValueError(f"invalid exit code in notify spec: {part!r}")
    return codes or None


def should_notify(exit_code: int, notify_codes: set[int] | None) -> bool:
    """Notify policy: explicit set membership, else 'any non-zero'."""
    if notify_codes is None:
        return exit_code != 0
    return exit_code in notify_codes


def truncate(text: str, limit: int = _MAX_OUTPUT_CHARS) -> str:
    if len(text) <= limit:
        return text
    head = text[: limit // 2]
    tail = text[-limit // 2:]
    omitted = len(text) - limit
    return f"{head}\n\n… [{omitted} chars omitted] …\n\n{tail}"


def run_command(command: str, cwd: str | None = None,
                timeout_s: int | None = None) -> tuple[int, str]:
    """Run ``command`` via the shell, returning ``(exit_code, combined_output)``.

    stdout and stderr are merged. A timeout is reported as exit code 124
    (the conventional ``timeout(1)`` code) with a note appended.
    """
    import subprocess

    try:
        proc = subprocess.run(
            command, shell=True, cwd=cwd,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, timeout=timeout_s,
        )
        return proc.returncode, proc.stdout or ""
    except subprocess.TimeoutExpired as e:
        partial = e.stdout or ""
        if isinstance(partial, bytes):
            partial = partial.decode("utf-8", "replace")
        return 124, f"{partial}\n\n[agentic_output] command timed out after {timeout_s}s"


def build_notification(*, command: str, exit_code: int, output: str,
                       task_name: str | None) -> tuple[str, str]:
    """Compose (title, message) for the workspace notification."""
    title = f"Task {task_name}" if task_name else "Scheduled command"
    message = (
        f"`{command}` exited {exit_code} (non-zero indicates failure).\n\n"
        f"{truncate(output)}"
    )
    return title, message
