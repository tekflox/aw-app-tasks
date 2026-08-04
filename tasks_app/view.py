"""Self-contained vanilla-JS view for the Tasks window, served as
``GET /api/apps/tasks/ui`` and iframed by ``windows/main.json`` (the same
"serve our own HTML, iframe it from the declarative window" pattern
``aw-app-whiteboard`` uses for ``/api/apps/whiteboard/view/{id}`` — see that
app's ``routes.py``/``viewer.py``).

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
<title>Scheduled Tasks</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 13px/1.4 -apple-system, system-ui, sans-serif;
         background: #0b0b10; color: #d8d8e0; }
  header { display: flex; align-items: center; justify-content: space-between;
           padding: 12px 16px; border-bottom: 1px solid #22222c; }
  h1 { font-size: 14px; margin: 0; }
  p.sub { margin: 2px 0 0; font-size: 11px; color: #82828f; }
  main { padding: 16px; max-width: 980px; margin: 0 auto; }
  button { cursor: pointer; border: 1px solid #33333f; background: #17171f;
           color: #d8d8e0; border-radius: 4px; padding: 5px 10px; font-size: 12px; }
  button:hover { background: #22222c; }
  button.primary { background: #2b3a55; border-color: #3a5580; color: #9fc3ff; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #1c1c24; font-size: 12px; }
  th { color: #82828f; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
  tr.task-row:hover { background: #14141a; }
  .badge { padding: 1px 6px; border-radius: 3px; font-family: monospace; font-size: 10px; }
  .badge.ok { background: rgba(46,204,113,.15); color: #6fe3a1; }
  .badge.error { background: rgba(231,76,60,.15); color: #f38b83; }
  .badge.running { background: rgba(52,152,219,.15); color: #7fc3ea; }
  .badge.muted { background: #1c1c24; color: #82828f; }
  .muted { color: #82828f; }
  .runs { padding: 6px 8px 10px 28px; font-size: 11px; }
  .runs .run { display: grid; grid-template-columns: 150px 60px 60px 1fr; gap: 8px;
               padding: 3px 0; border-bottom: 1px dashed #1c1c24; }
  dialog { border: 1px solid #33333f; border-radius: 8px; background: #14141a;
           color: #d8d8e0; width: 460px; max-width: 92vw; padding: 0; }
  dialog::backdrop { background: rgba(0,0,0,.5); }
  .dlg-head { padding: 12px 16px; border-bottom: 1px solid #22222c; font-weight: 600; }
  .dlg-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow-y: auto; }
  .dlg-foot { padding: 10px 16px; border-top: 1px solid #22222c; display: flex; justify-content: flex-end; gap: 8px; }
  label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #82828f; }
  input[type=text], input[type=number], textarea, select {
    width: 100%; background: #0b0b10; border: 1px solid #33333f; border-radius: 4px;
    color: #d8d8e0; padding: 6px 8px; font-size: 12px; font-family: inherit; }
  textarea { font-family: ui-monospace, monospace; resize: vertical; }
  .row { display: flex; gap: 8px; align-items: center; }
  .err { color: #f38b83; font-size: 11px; }
  .empty { padding: 40px; text-align: center; color: #82828f; border: 1px dashed #22222c;
           border-radius: 6px; margin-top: 16px; }
</style>
</head>
<body>
<header>
  <div>
    <h1>Scheduled Tasks</h1>
    <p class="sub">Each task fires a prompt into a CLI session, or runs a cheap command and notifies on a notable exit code.</p>
  </div>
  <button class="primary" id="new-task-btn">+ New task</button>
</header>
<main>
  <div id="error" class="err" style="display:none"></div>
  <div id="empty" class="empty" style="display:none">No tasks yet. Click "+ New task" to create one.</div>
  <table id="task-table" style="display:none">
    <thead><tr>
      <th>Name</th><th>Type</th><th>Schedule</th><th>On</th><th>Last run</th><th></th>
    </tr></thead>
    <tbody id="task-tbody"></tbody>
  </table>
</main>

<dialog id="task-dlg">
  <div class="dlg-head" id="dlg-title">New task</div>
  <div class="dlg-body">
    <div>
      <label>Name</label>
      <input type="text" id="f-name" placeholder="e.g. Daily standup digest"/>
    </div>
    <div>
      <label>Type</label>
      <select id="f-type">
        <option value="terminal">Terminal — fire a prompt into a CLI session</option>
        <option value="agentic_output">Agentic Output — run a command, notify on notable exit</option>
      </select>
    </div>
    <div id="f-terminal-fields">
      <label>Prompt</label>
      <textarea id="f-prompt" rows="3" placeholder="Shell command typed into the session, e.g. ./aw status"></textarea>
    </div>
    <div id="f-agentic-fields" style="display:none">
      <label>Command</label>
      <textarea id="f-command" rows="2" placeholder="Cheap shell command to run, e.g. ./aw test aw --unit"></textarea>
      <label style="margin-top:8px;display:block">Notify on exit code</label>
      <input type="text" id="f-notify-codes" placeholder="blank = any non-zero, or 1,2,127"/>
    </div>
    <div>
      <label>Schedule (cron, optional)</label>
      <input type="text" id="f-cron" placeholder="0 9 * * * — leave blank for manual-only"/>
    </div>
    <div class="row">
      <input type="checkbox" id="f-enabled" checked style="width:auto"/>
      <label style="text-transform:none;font-size:12px;color:#d8d8e0">Enabled</label>
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
let editingId = null;

function fmtTime(epoch) {
  if (!epoch) return '—';
  return new Date(epoch * 1000).toLocaleString();
}
function summarizeSchedules(s) {
  if (!s || !s.length) return '— (manual only)';
  if (s.length === 1) {
    const e = s[0];
    if (e.kind === 'cron') return 'cron · ' + e.expr;
    if (e.kind === 'daily') return 'daily ' + e.time;
    return e.kind;
  }
  return s.length + ' schedules';
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
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td class="muted">${t.type === 'agentic_output' ? 'agentic_output' : t.cli_type}</td>
      <td class="muted">${escapeHtml(summarizeSchedules(t.schedules))}</td>
      <td><span class="badge ${t.enabled ? 'ok' : 'muted'}">${t.enabled ? 'on' : 'off'}</span></td>
      <td><span class="badge ${statusClass}">${t.last_run_status || '—'}</span> <span class="muted">${fmtTime(t.last_run_at)}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button data-act="run" title="Run now">▶</button>
        <button data-act="toggle" title="Enable/disable">${t.enabled ? 'off' : 'on'}</button>
        <button data-act="delete" title="Delete">🗑</button>
        <button data-act="expand" title="Run history">⋯</button>
      </td>`;
    tr.querySelector('[data-act=run]').onclick = () => runTask(t.id);
    tr.querySelector('[data-act=toggle]').onclick = () => toggleTask(t);
    tr.querySelector('[data-act=delete]').onclick = () => deleteTask(t.id);
    tr.querySelector('[data-act=expand]').onclick = () => toggleRuns(tr, t);
    tbody.appendChild(tr);
  }
}

function toggleRuns(tr, task) {
  const existing = tr.nextElementSibling;
  if (existing && existing.classList.contains('runs-row')) {
    existing.remove();
    return;
  }
  const runsRow = document.createElement('tr');
  runsRow.className = 'runs-row';
  const td = document.createElement('td');
  td.colSpan = 6;
  td.className = 'runs';
  const runs = task.runs || [];
  td.innerHTML = runs.length
    ? runs.map(r => `<div class="run"><span class="muted">${fmtTime(r.started_at)}</span><span class="muted">${r.trigger}</span><span class="badge ${r.status === 'ok' ? 'ok' : 'error'}">${r.status}</span><span class="muted">${escapeHtml(r.error || r.output || '')}</span></div>`).join('')
    : '<span class="muted">No runs yet.</span>';
  runsRow.appendChild(td);
  tr.after(runsRow);
}

async function runTask(id) {
  try { await api(`/tasks/${id}/run`, {method: 'POST'}); await reload(); }
  catch (e) { showError(String(e.message || e)); }
}
async function toggleTask(t) {
  try { await api(`/tasks/${t.id}`, {method: 'PUT', body: JSON.stringify({enabled: !t.enabled})}); await reload(); }
  catch (e) { showError(String(e.message || e)); }
}
async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try { await api(`/tasks/${id}`, {method: 'DELETE'}); await reload(); }
  catch (e) { showError(String(e.message || e)); }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---- dialog ----
const dlg = document.getElementById('task-dlg');
document.getElementById('new-task-btn').onclick = () => openDialog(null);
document.getElementById('dlg-cancel').onclick = () => dlg.close();
document.getElementById('f-type').onchange = (e) => {
  const isAgentic = e.target.value === 'agentic_output';
  document.getElementById('f-terminal-fields').style.display = isAgentic ? 'none' : 'block';
  document.getElementById('f-agentic-fields').style.display = isAgentic ? 'block' : 'none';
};

function openDialog(task) {
  editingId = task ? task.id : null;
  document.getElementById('dlg-title').textContent = task ? ('Edit task — ' + task.name) : 'New task';
  document.getElementById('f-name').value = task ? task.name : '';
  document.getElementById('f-type').value = task ? task.type : 'terminal';
  document.getElementById('f-type').dispatchEvent(new Event('change'));
  document.getElementById('f-prompt').value = task ? (task.prompt || '') : '';
  document.getElementById('f-command').value = task ? (task.command || '') : '';
  document.getElementById('f-notify-codes').value = task ? (task.notify_exit_codes || '') : '';
  const cronEntry = task && (task.schedules || []).find(s => s.kind === 'cron');
  document.getElementById('f-cron').value = cronEntry ? cronEntry.expr : '';
  document.getElementById('f-enabled').checked = task ? !!task.enabled : true;
  document.getElementById('f-error').style.display = 'none';
  dlg.showModal();
}

document.getElementById('dlg-save').onclick = async () => {
  const errEl = document.getElementById('f-error');
  errEl.style.display = 'none';
  const name = document.getElementById('f-name').value.trim();
  if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }
  const type = document.getElementById('f-type').value;
  const cron = document.getElementById('f-cron').value.trim();
  const schedules = cron ? [{kind: 'cron', expr: cron}] : [];
  const payload = {
    name, type, prompt: document.getElementById('f-prompt').value,
    command: document.getElementById('f-command').value,
    notify_exit_codes: document.getElementById('f-notify-codes').value || null,
    schedules, enabled: document.getElementById('f-enabled').checked,
  };
  try {
    if (editingId) await api(`/tasks/${editingId}`, {method: 'PUT', body: JSON.stringify(payload)});
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
