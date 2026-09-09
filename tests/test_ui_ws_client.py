"""Runs the frontend WS client's own checks (``ui/test/ws.test.mjs``).

This repo has no JS test runner, and the release pipeline is a reusable
workflow in ``tekflox/aw-marketplace`` that only ever runs ``pytest tests/``.
A ``npm test`` nobody invokes is a test that bit-rots, so the node harness is
shelled out to from here instead — one file, discovered by the same glob as
everything else, green or red in the same run.

What it covers is the half of ``ui/src/ws.js`` that only executes when a
session expires or a socket drops (aw-ws/1 §7): no reconnect on 4401/4403/
4426, backoff on a transient close, a protocol bump surfaced instead of
silently ignored, ref-counting one socket across both UI slots. §12 of the
standard names those exact branches as the ones nothing in this estate tests.

Skips rather than fails where ``node`` is absent — a missing toolchain is not
a broken client.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

HARNESS = Path(__file__).resolve().parents[1] / "ui" / "test" / "ws.test.mjs"


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_ws_client_rules():
    result = subprocess.run(
        ["node", str(HARNESS)], capture_output=True, text=True, timeout=120,
    )
    assert result.returncode == 0, (
        f"ui/test/ws.test.mjs failed:\n{result.stdout}\n{result.stderr}")
    # Guards against the harness silently asserting nothing (an empty run also
    # exits 0) — every check prints one PASS line.
    assert "PASS" in result.stdout, result.stdout
