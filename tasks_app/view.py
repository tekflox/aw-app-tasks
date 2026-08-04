"""Self-contained vanilla-JS view for the Tasks window, served as
``GET /api/apps/tasks/ui`` and iframed by ``windows/main.json`` (the same
"serve our own HTML, iframe it from the declarative window" pattern
``aw-app-whiteboard`` uses for ``/api/apps/whiteboard/view/{id}`` — see that
app's ``routes.py``/``viewer.py``).

Visual/UX target: the aw monolith's ``src/app/src/components/TasksTab.jsx``
(segmented TYPE selector, contextual helper text per type, a chip-based
multi-schedule editor with live next-fire preview, a toggle switch for
Enabled, per-task run history). Ported as vanilla HTML/CSS/JS — no
React/build step — since that's this app's existing architecture and the
plugin-host wiring a `component`-mode bundle would need isn't live yet (see
below).

Only two of the monolith's three task TYPEs are offered here — Terminal and
Agentic Output. `agent_prompt` is deliberately left out of the segmented
selector: ``manager.py`` explicitly does not implement it (no Agents
Platform dependency wired into this decoupled app yet — a task created with
that type would just record a `status=error` run explaining why). Offering
a button that always fails would be worse UX than the plain two-way choice
below.

Why not the React ``TasksTab.jsx`` component-mode bundle: this app's
``ui/src/TasksTab.jsx`` *is* a ported copy of the monolith's TasksTab (see
that file), staged the same way ``aw-app-whiteboard``/``aw-app-presentations``
stage their own ported React windows — the SPA plugin-host wiring
(``installPluginHost``/``fetchContributions``/``<AppSlot>``) those two repos'
READMEs flag as still-missing is the same gap here, so a `component`-mode
bundle would not actually run today. This vanilla page has zero such
dependency and is what's actually live/clickable right now.
"""
from __future__ import annotations


def build_view_html() -> str:
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Tasks</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0b0b10;
    --bg2: #14141a;
    --bg3: #17171f;
    --border: #26262f;
    --border-strong: #33333f;
    --text: #d8d8e0;
    --muted: #82828f;
    --accent: #f0883e;
    --accent-dim: rgba(240,136,62,.15);
    --accent-dim2: rgba(240,136,62,.25);
    --ok: #3fb950;
    --ok-dim: rgba(63,185,80,.15);
    --danger: #f85149;
    --danger-dim: rgba(248,81,73,.12);
    --info: #58a6ff;
    --info-dim: rgba(88,166,255,.15);
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 13px/1.4 -apple-system, system-ui, "Segoe UI", sans-serif;
         background: var(--bg); color: var(--text); }
  header { display: flex; align-items: center; justify-content: space-between;
           padding: 12px 16px; border-bottom: 1px solid var(--border); }
  h1 { font-size: 14px; margin: 0; font-weight: 600; }
  p.sub { margin: 2px 0 0; font-size: 11px; color: var(--muted); }
  main { padding: 16px; max-width: 1080px; margin: 0 auto; }
  button { cursor: pointer; border: 1px solid var(--border-strong); background: var(--bg3);
           color: var(--text); border-radius: 4px; padding: 5px 10px; font-size: 12px;
           font-family: inherit; }
  button:hover { background: #22222c; }
  button:disabled { opacity: .35; cursor: not-allowed; }
  button.primary { background: var(--accent-dim); border-color: transparent; color: var(--accent); }
  button.primary:hover { background: var(--accent-dim2); }
  button.icon-btn { border: none; background: transparent; padding: 4px; border-radius: 4px;
                     display: inline-flex; align-items: center; justify-content: center; }
  button.icon-btn:hover { background: rgba(255,255,255,.08); }
  button.icon-btn.danger:hover { color: var(--danger); }
  button.icon-btn.accent:hover { color: var(--accent); }
  svg.ic { width: 14px; height: 14px; }

  table { width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid var(--border);
          border-radius: 6px; overflow: hidden; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); font-size: 12px; }
  thead th { color: var(--muted); text-transform: uppercase; font-size: 10px; letter-spacing: .04em;
             background: var(--bg2); border-bottom: 1px solid var(--border); font-weight: 600; }
  tbody tr.task-row { cursor: pointer; }
  tbody tr.task-row:hover { background: rgba(255,255,255,.02); }
  tbody tr:last-child td { border-bottom: none; }
  td.name-cell { display: flex; align-items: center; gap: 6px; }
  .caret { color: var(--muted); font-size: 9px; width: 10px; display: inline-block; }

  .badge { padding: 1px 6px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 10px;
           display: inline-block; }
  .badge.ok { background: var(--ok-dim); color: #6fe3a1; }
  .badge.error { background: var(--danger-dim); color: #f38b83; }
  .badge.running { background: var(--info-dim); color: #7fc3ea; }
  .badge.muted { background: rgba(255,255,255,.05); color: var(--muted); }
  .muted { color: var(--muted); }

  .on-pill { font-size: 10px; padding: 1px 6px; border-radius: 3px; border: none; }
  .on-pill.on { background: var(--ok-dim); color: #6fe3a1; }
  .on-pill.off { background: rgba(255,255,255,.05); color: var(--muted); }

  .runs { padding: 8px 10px 12px 30px; font-size: 11px; background: rgba(255,255,255,.015); }
  .runs .run { display: grid; grid-template-columns: 150px 60px 60px 1fr; gap: 8px;
               padding: 3px 0; border-bottom: 1px dashed var(--border); }
  .runs .run:last-child { border-bottom: none; }

  dialog { border: 1px solid var(--border-strong); border-radius: 8px; background: var(--bg2);
           color: var(--text); width: 600px; max-width: 94vw; padding: 0; }
  dialog::backdrop { background: rgba(0,0,0,.55); backdrop-filter: blur(2px); }
  .dlg-head { padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 600;
              display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
  .dlg-head .x { cursor: pointer; color: var(--muted); font-size: 18px; line-height: 1; }
  .dlg-head .x:hover { color: var(--text); }
  .dlg-body { padding: 16px; display: flex; flex-direction: column; gap: 16px; max-height: 65vh; overflow-y: auto; }
  .dlg-foot { padding: 10px 16px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }

  .field label, .lbl { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
          color: var(--muted); margin-bottom: 4px; }
  .hint { font-size: 10px; color: var(--muted); margin-top: 4px; line-height: 1.4; }
  .hint code, .mono { font-family: ui-monospace, monospace; }

  input[type=text], input[type=number], input[type=time], input[type=datetime-local], textarea, select {
    width: 100%; background: var(--bg); border: 1px solid var(--border-strong); border-radius: 4px;
    color: var(--text); padding: 6px 8px; font-size: 12px; font-family: inherit; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); }
  textarea { font-family: ui-monospace, monospace; resize: vertical; }
  .row { display: flex; gap: 8px; align-items: center; }
  .err { color: #f38b83; font-size: 11px; padding: 7px 9px; border-radius: 4px;
         background: var(--danger-dim); border: 1px solid rgba(248,81,73,.3); }
  .empty { padding: 40px; text-align: center; color: var(--muted); border: 1px dashed var(--border);
           border-radius: 6px; margin-top: 16px; }

  /* ---- Segmented TYPE selector ---- */
  .segmented { display: inline-flex; border: 1px solid var(--border-strong); border-radius: 5px;
               overflow: hidden; width: fit-content; }
  .segmented button { border: none; border-right: 1px solid var(--border-strong); border-radius: 0;
                       background: var(--bg); color: var(--muted); padding: 6px 14px; font-size: 12px; }
  .segmented button:last-child { border-right: none; }
  .segmented button.active { background: var(--accent); color: #fff; font-weight: 600; }
  .segmented button:hover:not(.active) { background: #1c1c24; }

  /* ---- Toggle switch ---- */
  .toggle-row { display: flex; align-items: flex-start; gap: 10px; }
  .toggle-text { flex: 1; min-width: 0; }
  .toggle-title { font-size: 12px; color: var(--text); }
  .toggle-sub { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .switch { position: relative; display: inline-flex; align-items: center; width: 36px; height: 20px;
            border-radius: 999px; background: rgba(255,255,255,.1); border: none; padding: 0; cursor: pointer;
            flex-shrink: 0; transition: background .15s; }
  .switch:hover { background: rgba(255,255,255,.15); }
  .switch.on { background: var(--ok); }
  .switch.on:hover { background: var(--ok); }
  .switch .knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
                  background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.4); transition: transform .15s; }
  .switch.on .knob { transform: translateX(16px); }

  /* ---- Schedule chip editor ---- */
  .sched-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .sched-list { display: flex; flex-direction: column; gap: 8px; }
  .sched-row { border: 1px solid var(--border); border-radius: 5px; padding: 8px; background: rgba(0,0,0,.15); }
  .sched-row.invalid { border-color: rgba(248,81,73,.5); }
  .sched-row-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .sched-row-top select { width: auto; flex-shrink: 0; }
  .sched-next { font-size: 10px; color: var(--muted); margin-left: auto; white-space: nowrap; }
  .sched-next .val { color: var(--accent); font-family: ui-monospace, monospace; }
  .day-chip { padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--border-strong);
              background: var(--bg); color: var(--muted); }
  .day-chip.active { background: var(--accent-dim); color: var(--accent); border-color: rgba(240,136,62,.4); }
  .day-row { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
  .sched-add { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
  .sched-add .lbl-inline { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .add-chip { padding: 4px 9px; font-size: 11px; border-radius: 4px; border: none;
              background: var(--accent-dim); color: var(--accent); }
  .add-chip:hover { background: var(--accent-dim2); }
  .sched-summary { font-size: 10px; color: var(--muted); }
  .sched-err { color: #f38b83; font-size: 10px; margin-top: 4px; }
</style>
</head>
<body>
<header>
  <div>
    <h1>Tasks</h1>
    <p class="sub">Each task fires a prompt into a reusable CLI session, or runs a cheap command and notifies on a notable exit code.</p>
  </div>
  <button class="primary" id="new-task-btn">+ New task</button>
</header>
<main>
  <div id="error" class="err" style="display:none;margin-bottom:10px"></div>
  <div id="empty" class="empty" style="display:none">No tasks yet. Click "+ New task" to create one.</div>
  <table id="task-table" style="display:none">
    <thead><tr>
      <th>Name</th><th>Type</th><th>Schedule</th><th>On</th><th>Last run</th><th style="text-align:right">Actions</th>
    </tr></thead>
    <tbody id="task-tbody"></tbody>
  </table>
</main>

<dialog id="task-dlg">
  <div class="dlg-head">
    <span id="dlg-title">New task</span>
    <span class="x" id="dlg-x">&times;</span>
  </div>
  <div class="dlg-body">
    <div class="field">
      <label>Name</label>
      <input type="text" id="f-name" placeholder="e.g. Daily standup digest"/>
      <div class="hint">The bound terminal session will be named <span class="mono">"Task: <span id="f-name-echo">&lt;name&gt;</span>"</span>.</div>
    </div>

    <div class="field">
      <label>Type</label>
      <div class="segmented" id="type-seg">
        <button type="button" data-type="terminal">Terminal</button>
        <button type="button" data-type="agentic_output">Agentic Output</button>
      </div>
      <div class="hint" id="type-hint"></div>
    </div>

    <div id="fields-terminal">
      <div class="field">
        <label>Command</label>
        <textarea id="f-prompt" rows="3" placeholder="Shell command typed into the bash session, e.g. ./aw status"></textarea>
        <div class="hint">Runs in a plain bash terminal session. Lines are executed followed by Enter — supports pipes, multiple commands separated by <span class="mono">;</span> or <span class="mono">&amp;&amp;</span>.</div>
      </div>
    </div>

    <div id="fields-agentic" style="display:none">
      <div class="field">
        <label>Command</label>
        <textarea id="f-command" rows="3" placeholder="Cheap shell command to run first, e.g. a diff/check script — no LLM cost."></textarea>
        <div class="hint">Runs on every fire. A workspace notification only fires when the exit code is notable — this is what keeps the type cheap.</div>
      </div>
      <div class="field" style="margin-top:10px">
        <label>Notify on exit code</label>
        <input type="text" id="f-notify-codes" placeholder="blank = any non-zero · or a list like 1,2,127"/>
        <div class="hint">Which exit codes count as "there's a difference" and trigger the notification. Leave blank for any non-zero.</div>
      </div>
    </div>

    <div class="field">
      <div class="sched-head">
        <span class="lbl" style="margin:0">Schedules</span>
        <span class="sched-summary" id="sched-next-summary">No schedule — runs only on manual ▶</span>
      </div>
      <div class="sched-list" id="sched-list"></div>
      <div class="sched-add">
        <span class="lbl-inline">Add:</span>
        <button type="button" class="add-chip" data-kind="once">+ Once</button>
        <button type="button" class="add-chip" data-kind="daily">+ Daily</button>
        <button type="button" class="add-chip" data-kind="weekly">+ Weekly</button>
        <button type="button" class="add-chip" data-kind="monthly">+ Monthly</button>
        <button type="button" class="add-chip" data-kind="cron">+ Cron</button>
      </div>
    </div>

    <div class="toggle-row">
      <button type="button" class="switch" id="f-enabled-switch"><span class="knob"></span></button>
      <div class="toggle-text">
        <div class="toggle-title">Enabled</div>
        <div class="toggle-sub">When off, scheduled fires are skipped. Manual ▶ Run-now still works.</div>
      </div>
    </div>

    <div id="f-error" class="err" style="display:none"></div>
  </div>
  <div class="dlg-foot">
    <button id="dlg-cancel">Cancel</button>
    <button class="primary" id="dlg-save">Save</button>
  </div>
</dialog>

<script>
const API = '/api/apps/tasks';
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let editingId = null;
let taskType = 'terminal';
let enabled = true;
let schedules = [];
let schedPreview = null;
let previewTimer = null;

const TYPE_HINTS = {
  terminal: 'Runs a CLI/command in a reusable terminal session.',
  agentic_output: 'Runs a command; on a notable exit code, a workspace notification reports the output.',
};

function fmtTime(epoch) {
  if (!epoch) return '—';
  return new Date(epoch * 1000).toLocaleString();
}
function fmtRelative(epoch) {
  if (!epoch) return '—';
  const delta = Date.now() / 1000 - epoch;
  if (delta < 60) return Math.floor(delta) + 's ago';
  if (delta < 3600) return Math.floor(delta / 60) + 'm ago';
  if (delta < 86400) return Math.floor(delta / 3600) + 'h ago';
  return Math.floor(delta / 86400) + 'd ago';
}
function summarizeSchedule(s) {
  if (!s) return '—';
  switch (s.kind) {
    case 'once': try { return 'Once · ' + new Date(s.at).toLocaleString(); } catch (e) { return 'Once · ' + s.at; }
    case 'daily': return 'Daily ' + s.time;
    case 'weekly': {
      const days = (s.days || []).map(d => DAY_NAMES[d] || d).join('/');
      return 'Weekly ' + days + ' ' + s.time;
    }
    case 'monthly': return 'Monthly day ' + s.day_of_month + ' at ' + s.time;
    case 'cron': return 'Cron · ' + s.expr;
    default: return JSON.stringify(s);
  }
}
function summarizeSchedules(scheds) {
  if (!scheds || !scheds.length) return '—';
  if (scheds.length === 1) return summarizeSchedule(scheds[0]);
  return scheds.length + ' schedules';
}
function defaultForKind(kind) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = pad(now.getHours()) + ':' + pad(Math.min(59, now.getMinutes()));
  switch (kind) {
    case 'once': {
      const future = new Date(now.getTime() + 60 * 60 * 1000);
      const iso = future.getFullYear() + '-' + pad(future.getMonth() + 1) + '-' + pad(future.getDate()) +
                  'T' + pad(future.getHours()) + ':' + pad(future.getMinutes());
      return { kind: 'once', at: iso };
    }
    case 'daily': return { kind: 'daily', time: hhmm };
    case 'weekly': return { kind: 'weekly', days: [0,1,2,3,4], time: hhmm };
    case 'monthly': return { kind: 'monthly', day_of_month: 1, time: hhmm };
    case 'cron': return { kind: 'cron', expr: '0 9 * * *' };
    default: return { kind: 'daily', time: hhmm };
  }
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function api(path, opts) {
  const res = await fetch(API + path, Object.assign({
    headers: {'Content-Type': 'application/json'},
  }, opts || {}));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || ('HTTP ' + res.status));
  }
  return res.json();
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

async function reload() {
  try {
    const data = await api('/tasks');
    renderTasks(data.tasks || []);
    showError('');
  } catch (e) {
    showError(String(e.message || e));
  }
}

function renderTasks(tasks) {
  const table = document.getElementById('task-table');
  const empty = document.getElementById('empty');
  const tbody = document.getElementById('task-tbody');
  tbody.innerHTML = '';
  if (!tasks.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  table.style.display = 'table';
  empty.style.display = 'none';

  for (const t of tasks) {
    const tr = document.createElement('tr');
    tr.className = 'task-row';
    const statusClass = t.last_run_status === 'ok' ? 'ok' : t.last_run_status === 'error' ? 'error' : 'muted';
    const typeLabel = t.type === 'agentic_output' ? 'agentic_output' : (t.cli_type || 'terminal');
    tr.innerHTML =
      '<td class="name-cell"><span class="caret">&#9654;</span><span>' + escapeHtml(t.name) + '</span></td>' +
      '<td class="muted mono">' + escapeHtml(typeLabel) + '</td>' +
      '<td class="muted" title="' + escapeHtml((t.schedules||[]).map(summarizeSchedule).join('\\n')) + '">' + escapeHtml(summarizeSchedules(t.schedules)) + '</td>' +
      '<td><button class="on-pill ' + (t.enabled ? 'on' : 'off') + '" data-act="toggle">' + (t.enabled ? 'on' : 'off') + '</button></td>' +
      '<td><span class="badge ' + statusClass + '">' + (t.last_run_status || '—') + '</span> <span class="muted" title="' + escapeHtml(fmtTime(t.last_run_at)) + '">' + escapeHtml(fmtRelative(t.last_run_at)) + '</span></td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        '<button class="icon-btn" data-act="run" title="Run now" style="color:#6fe3a1"><svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>' +
        '<button class="icon-btn accent" data-act="edit" title="Edit"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
        '<button class="icon-btn danger" data-act="delete" title="Delete"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>' +
      '</td>';
    tr.querySelector('[data-act=run]').onclick = (e) => { e.stopPropagation(); runTask(t.id); };
    tr.querySelector('[data-act=toggle]').onclick = (e) => { e.stopPropagation(); toggleTask(t); };
    tr.querySelector('[data-act=delete]').onclick = (e) => { e.stopPropagation(); deleteTask(t.id); };
    tr.querySelector('[data-act=edit]').onclick = (e) => { e.stopPropagation(); openDialog(t); };
    tr.onclick = () => toggleRuns(tr, t);
    tbody.appendChild(tr);
  }
}

function toggleRuns(tr, task) {
  const caret = tr.querySelector('.caret');
  const existing = tr.nextElementSibling;
  if (existing && existing.classList.contains('runs-row')) {
    existing.remove();
    if (caret) caret.innerHTML = '&#9654;';
    return;
  }
  if (caret) caret.innerHTML = '&#9660;';
  const runsRow = document.createElement('tr');
  runsRow.className = 'runs-row';
  const td = document.createElement('td');
  td.colSpan = 6;
  td.className = 'runs';
  const runs = task.runs || [];
  td.innerHTML = runs.length
    ? runs.map(r => '<div class="run"><span class="muted">' + escapeHtml(fmtTime(r.started_at)) + '</span><span class="muted">' + escapeHtml(r.trigger||'') + '</span><span class="badge ' + (r.status === 'ok' ? 'ok' : 'error') + '">' + escapeHtml(r.status||'') + '</span><span class="muted mono">' + escapeHtml(r.error || r.output || '') + '</span></div>').join('')
    : '<span class="muted">No runs yet.</span>';
  runsRow.appendChild(td);
  tr.after(runsRow);
}

async function runTask(id) {
  try { await api('/tasks/' + id + '/run', {method: 'POST'}); await reload(); }
  catch (e) { showError(String(e.message || e)); }
}
async function toggleTask(t) {
  try { await api('/tasks/' + t.id, {method: 'PUT', body: JSON.stringify({enabled: !t.enabled})}); await reload(); }
  catch (e) { showError(String(e.message || e)); }
}
async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try { await api('/tasks/' + id, {method: 'DELETE'}); await reload(); }
  catch (e) { showError(String(e.message || e)); }
}

// ---------------------------------------------------------------------
// Type segmented control
// ---------------------------------------------------------------------
function setType(t) {
  taskType = t;
  document.querySelectorAll('#type-seg button').forEach(b => {
    b.classList.toggle('active', b.dataset.type === t);
  });
  document.getElementById('fields-terminal').style.display = t === 'terminal' ? 'block' : 'none';
  document.getElementById('fields-agentic').style.display = t === 'agentic_output' ? 'block' : 'none';
  document.getElementById('type-hint').textContent = TYPE_HINTS[t] || '';
}
document.querySelectorAll('#type-seg button').forEach(b => {
  b.onclick = () => setType(b.dataset.type);
});

// ---------------------------------------------------------------------
// Enabled switch
// ---------------------------------------------------------------------
function setEnabled(v) {
  enabled = v;
  document.getElementById('f-enabled-switch').classList.toggle('on', v);
}
document.getElementById('f-enabled-switch').onclick = () => setEnabled(!enabled);

// ---------------------------------------------------------------------
// Schedule chip editor
// ---------------------------------------------------------------------
function renderSchedules() {
  const list = document.getElementById('sched-list');
  list.innerHTML = '';
  schedules.forEach((s, i) => list.appendChild(scheduleRowEl(s, i)));
  schedulePreview();
}

function scheduleRowEl(value, i) {
  const entry = schedPreview && schedPreview.entries ? schedPreview.entries.find(e => e.index === i) : null;
  const error = entry && !entry.ok ? entry.error : null;
  const wrap = document.createElement('div');
  wrap.className = 'sched-row' + (error ? ' invalid' : '');

  const top = document.createElement('div');
  top.className = 'sched-row-top';
  const sel = document.createElement('select');
  ['once','daily','weekly','monthly','cron'].forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k === 'cron' ? 'Cron (advanced)' : k.charAt(0).toUpperCase() + k.slice(1);
    if (k === value.kind) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = () => { schedules[i] = defaultForKind(sel.value); renderSchedules(); };
  top.appendChild(sel);

  const next = document.createElement('span');
  next.className = 'sched-next';
  if (entry && entry.ok && entry.next_fire_at && !error) {
    next.innerHTML = 'Next: <span class="val">' + escapeHtml(fmtTime(entry.next_fire_at)) + '</span>';
  }
  top.appendChild(next);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'icon-btn danger';
  rm.title = 'Remove schedule';
  rm.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
  rm.onclick = () => { schedules.splice(i, 1); renderSchedules(); };
  top.appendChild(rm);

  wrap.appendChild(top);

  const body = document.createElement('div');
  const patch = (p) => { schedules[i] = Object.assign({}, schedules[i], p); scheduleDebounced(); };

  if (value.kind === 'once') {
    const inp = document.createElement('input');
    inp.type = 'datetime-local';
    inp.value = value.at || '';
    inp.oninput = () => patch({ at: inp.value });
    body.appendChild(inp);
  } else if (value.kind === 'daily') {
    body.innerHTML = '<div class="row"><span class="muted" style="font-size:11px;width:24px">at</span></div>';
    const inp = document.createElement('input');
    inp.type = 'time';
    inp.value = value.time || '';
    inp.style.width = 'auto';
    inp.oninput = () => patch({ time: inp.value });
    body.querySelector('.row').appendChild(inp);
  } else if (value.kind === 'weekly') {
    const dayRow = document.createElement('div');
    dayRow.className = 'day-row';
    DAY_NAMES.forEach((label, di) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'day-chip' + ((value.days||[]).includes(di) ? ' active' : '');
      chip.textContent = label;
      chip.onclick = () => {
        const days = new Set(value.days || []);
        if (days.has(di)) days.delete(di); else days.add(di);
        patch({ days: [...days].sort((a,b) => a-b) });
        renderSchedules();
      };
      dayRow.appendChild(chip);
    });
    body.appendChild(dayRow);
    const timeRow = document.createElement('div');
    timeRow.className = 'row';
    timeRow.innerHTML = '<span class="muted" style="font-size:11px;width:24px">at</span>';
    const inp = document.createElement('input');
    inp.type = 'time';
    inp.value = value.time || '';
    inp.style.width = 'auto';
    inp.oninput = () => patch({ time: inp.value });
    timeRow.appendChild(inp);
    body.appendChild(timeRow);
  } else if (value.kind === 'monthly') {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<span class="muted" style="font-size:11px">on day</span>';
    const domInp = document.createElement('input');
    domInp.type = 'number'; domInp.min = 1; domInp.max = 31; domInp.style.width = '64px';
    domInp.value = value.day_of_month != null ? value.day_of_month : 1;
    domInp.oninput = () => patch({ day_of_month: Number(domInp.value) });
    row.appendChild(domInp);
    const atSpan = document.createElement('span');
    atSpan.className = 'muted'; atSpan.style.fontSize = '11px'; atSpan.textContent = 'at';
    row.appendChild(atSpan);
    const timeInp = document.createElement('input');
    timeInp.type = 'time'; timeInp.style.width = 'auto';
    timeInp.value = value.time || '';
    timeInp.oninput = () => patch({ time: timeInp.value });
    row.appendChild(timeInp);
    body.appendChild(row);
  } else if (value.kind === 'cron') {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'mono';
    inp.placeholder = '0 9 * * *';
    inp.value = value.expr || '';
    inp.oninput = () => patch({ expr: inp.value });
    body.appendChild(inp);
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.innerHTML = '5 fields: minute hour day-of-month month day-of-week. Examples: <span class="mono">*/15 * * * *</span>, <span class="mono">0 9 * * 1-5</span>, <span class="mono">@hourly</span>.';
    body.appendChild(hint);
  }
  wrap.appendChild(body);

  if (error) {
    const errEl = document.createElement('div');
    errEl.className = 'sched-err';
    errEl.textContent = error;
    wrap.appendChild(errEl);
  }

  return wrap;
}

function scheduleDebounced() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(schedulePreview, 300);
}

async function schedulePreview() {
  const summaryEl = document.getElementById('sched-next-summary');
  if (!schedules.length) {
    schedPreview = null;
    summaryEl.textContent = 'No schedule — runs only on manual ▶';
    return;
  }
  try {
    const data = await api('/preview-schedules', {method: 'POST', body: JSON.stringify({schedules})});
    schedPreview = data;
    if (data.next_fire_at) {
      summaryEl.innerHTML = 'Next fires: <span class="val" style="color:var(--accent);font-family:ui-monospace,monospace">' + escapeHtml(fmtTime(data.next_fire_at)) + '</span>';
    } else {
      summaryEl.textContent = 'No upcoming fire';
    }
    // Re-render to show per-row errors/next-fire without losing focus badly —
    // acceptable UX tradeoff for a settings dialog.
    const list = document.getElementById('sched-list');
    list.innerHTML = '';
    schedules.forEach((s, i) => list.appendChild(scheduleRowEl(s, i)));
  } catch (e) {
    summaryEl.textContent = 'Preview unavailable';
  }
}

document.querySelectorAll('.add-chip').forEach(btn => {
  btn.onclick = () => {
    schedules.push(defaultForKind(btn.dataset.kind));
    renderSchedules();
  };
});

// ---------------------------------------------------------------------
// Dialog open/save
// ---------------------------------------------------------------------
const dlg = document.getElementById('task-dlg');
document.getElementById('new-task-btn').onclick = () => openDialog(null);
document.getElementById('dlg-cancel').onclick = () => dlg.close();
document.getElementById('dlg-x').onclick = () => dlg.close();

document.getElementById('f-name').oninput = (e) => {
  document.getElementById('f-name-echo').textContent = e.target.value || '<name>';
};

function openDialog(task) {
  editingId = task ? task.id : null;
  document.getElementById('dlg-title').textContent = task ? ('Edit task — ' + task.name) : 'New task';
  document.getElementById('f-name').value = task ? task.name : '';
  document.getElementById('f-name-echo').textContent = (task && task.name) || '<name>';
  setType(task ? (task.type === 'agentic_output' ? 'agentic_output' : 'terminal') : 'terminal');
  document.getElementById('f-prompt').value = task ? (task.prompt || '') : '';
  document.getElementById('f-command').value = task ? (task.command || '') : '';
  document.getElementById('f-notify-codes').value = task ? (task.notify_exit_codes || '') : '';
  schedules = task ? JSON.parse(JSON.stringify(task.schedules || [])) : [];
  schedPreview = null;
  renderSchedules();
  setEnabled(task ? !!task.enabled : true);
  document.getElementById('f-error').style.display = 'none';
  dlg.showModal();
}

document.getElementById('dlg-save').onclick = async () => {
  const errEl = document.getElementById('f-error');
  errEl.style.display = 'none';
  const name = document.getElementById('f-name').value.trim();
  if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }
  const command = document.getElementById('f-command').value;
  if (taskType === 'agentic_output' && !command.trim()) {
    errEl.textContent = 'Command is required.'; errEl.style.display = 'block'; return;
  }
  const payload = {
    name, type: taskType, cli_type: 'terminal',
    prompt: document.getElementById('f-prompt').value,
    command: taskType === 'agentic_output' ? command : null,
    notify_exit_codes: document.getElementById('f-notify-codes').value || null,
    schedules, enabled,
  };
  try {
    if (editingId) await api('/tasks/' + editingId, {method: 'PUT', body: JSON.stringify(payload)});
    else await api('/tasks', {method: 'POST', body: JSON.stringify(payload)});
    dlg.close();
    await reload();
  } catch (e) {
    errEl.textContent = String(e.message || e);
    errEl.style.display = 'block';
  }
};

reload();
setInterval(reload, 10000);
</script>
</body>
</html>"""
