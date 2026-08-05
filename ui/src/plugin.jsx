// Integrated-mode entrypoint — dynamic-imported by aw-workspace-ui's
// loadComponentPlugin() once this app is installed with "ui:code" +
// "ui:slots:core.nav.workspace" granted. Built by `npm run build` ->
// ui/dist/tasks.js, referenced from aw-app.json's contributes.frontend.bundle.
//
// register(host) is the ONE required export. `host` is the APP-SCOPED handle
// from aw-workspace-ui's hostForApp() (src/apps/pluginHost.js) — host.React /
// host.h are the shared instances (never import your own React), host.app.*
// are this app's own `/api/apps/tasks/...` helpers, host.registerSlot is how
// this fills the `core.nav.workspace` slot WorkspaceNav.jsx renders inside
// its "Workspace" popover, host.registerWindow is how it fills its own
// floating window (core.window.body:tasks.main).
//
// JSX in this file compiles to host.h(...)/host.React.Fragment calls, not
// react's own createElement — see vite.config.js's esbuild.jsxFactory. Every
// component below is a plain function DECLARED INSIDE register(host) so it
// closes over `host` without importing react itself (ADR "one shared React
// instance" — external: ['react','react-dom'] in vite.config.js).
//
// Owns BOTH contributions this app makes to the SPA (2026-08-04 decision:
// aw-workspace-ui carries zero app-specific window/nav logic):
//
// 1. TasksNavSlot -> core.nav.workspace — the compact "Tasks" row +
//    quick-glance flyout inside the Workspace popover. "Open all ->" now
//    calls window.__awOpenAppWindow('tasks.main') (the generic hook
//    App.jsx exposes) instead of the old per-app __awOpenTasksPanel global.
// 2. TasksWindowBody -> core.window.body:tasks.main — the full CRUD floating
//    window (table, ScheduleEditor, TaskEditor modal, Run History +
//    Generated Assets carousel per row). Ported verbatim from
//    aw-workspace-ui's now-deleted src/components/TasksTab.jsx, with
//    core's `apiFetch` (../auth) swapped for host.sdk.api.fetch (routes
//    through the same BYOD apiBase.js rewrite shim) and this app's own
//    `/api/apps/tasks/*` paths built via host.app.apiUrl(). The one
//    cross-app route (/api/apps/presentations/presentations, owned by
//    aw-app-presentations) calls host.sdk.api.fetch
//    directly with the literal path — same mechanism, just not app-scoped.

import { createClient } from './client.js';

export function register(host) {
  const client = createClient({
    apiUrl: host.app.apiUrl,
    fetchImpl: host.sdk.api.fetch,
  });

  const { useState, useRef, useCallback, useEffect } = host.React;

  function TasksIcon() {
    return (
      <svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }

  function PlayIcon() {
    return <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
  }

  function scheduleSummary(task) {
    const schedules = task.schedules || [];
    if (schedules.length === 0) return 'manual';
    if (schedules.length > 1) return `${schedules.length} schedules`;
    const s = schedules[0];
    if (s.kind === 'cron') return s.expr || 'cron';
    return s.kind || 'scheduled';
  }

  // ------------------------------------------------------------------
  // 1. Nav row + quick-glance flyout
  // ------------------------------------------------------------------
  function TasksNavSlot() {
    const [submenu, setSubmenu] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState(null);
    const [busyTask, setBusyTask] = useState(null);
    const closeTimer = useRef(null);

    const refreshTasks = useCallback(async () => {
      try {
        setTasks(await client.listTasks());
        setError(null);
      } catch (e) {
        setError(String(e.message || e));
      }
    }, []);

    useEffect(() => {
      refreshTasks();
      const handler = () => refreshTasks();
      window.addEventListener('aw-task-update', handler);
      return () => window.removeEventListener('aw-task-update', handler);
    }, [refreshTasks]);

    useEffect(() => () => clearTimeout(closeTimer.current), []);

    const enter = useCallback(() => {
      clearTimeout(closeTimer.current);
      setSubmenu(true);
      refreshTasks();
    }, [refreshTasks]);

    const leave = useCallback(() => {
      closeTimer.current = setTimeout(() => setSubmenu(false), 150);
    }, []);

    const openAll = useCallback(() => {
      setSubmenu(false);
      window.__awOpenAppWindow?.('tasks.main');
    }, []);

    const runTaskNow = useCallback(async (task) => {
      setBusyTask(task.id);
      setError(null);
      try {
        await client.runTask(task.id);
        await refreshTasks();
      } catch (e) {
        setError(`${task.name}: ${e.message || e}`);
      } finally {
        setBusyTask(null);
      }
    }, [refreshTasks]);

    return (
      <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
        <div
          onClick={openAll}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer"
        >
          <TasksIcon />
          <span className="flex-1 text-[13px] text-[var(--color-text-primary)]">Tasks</span>
          {tasks.length > 0 && (
            <span className="text-[10px] text-[var(--color-text-muted)]">{tasks.length}</span>
          )}
          <svg className="w-3 h-3 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
        </div>
        {submenu && (
          <div
            className="absolute left-full top-0 ml-1 z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-2"
            style={{ minWidth: 320, maxWidth: 420 }}
          >
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                Tasks · {tasks.length}
              </span>
              <button
                onClick={openAll}
                className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                title="Open Tasks window"
              >
                Open all →
              </button>
            </div>
            {error && (
              <div className="mx-1 mb-2 px-2 py-1 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30">
                {error}
              </div>
            )}
            {tasks.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)] italic">
                No tasks yet. Click "Open all →" to create one.
              </div>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
                {tasks.map((t) => {
                  const busy = busyTask === t.id;
                  const dotColor =
                    t.last_run_status === 'ok' ? 'bg-green-400' :
                    t.last_run_status === 'error' ? 'bg-red-400' :
                    t.last_run_status === 'running' ? 'bg-blue-400' :
                    'bg-white/20';
                  return (
                    <div
                      key={t.id}
                      className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.05]"
                      title={t.name}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] text-[var(--color-text-primary)] truncate">{t.name}</span>
                          {!t.enabled && (
                            <span className="px-1 py-0.5 rounded text-[9px] bg-white/5 text-[var(--color-text-muted)] shrink-0">off</span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] truncate font-mono">
                          {t.type === 'agent_prompt' || t.type === 'agentic_output' ? t.type : t.cli_type} · {scheduleSummary(t)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); runTaskNow(t); }}
                        disabled={busy}
                        className="p-1 rounded hover:bg-white/10 text-green-400 disabled:opacity-50 shrink-0"
                        title="Run now"
                      >
                        {busy
                          ? <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M4 12a8 8 0 0 1 8-8" /></svg>
                          : <PlayIcon />
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 2. Window body — full CRUD (table, ScheduleEditor, TaskEditor,
  //    Run History + Generated Assets). Ported from TasksTab.jsx.
  // ------------------------------------------------------------------

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Grid column templates as inline styles, not Tailwind arbitrary-value
  // classes (`grid-cols-[...]`) — this app's JSX ships in a separate repo
  // from aw-workspace-ui, whose Tailwind build only scans ITS OWN source.
  // An arbitrary-value class only renders if the exact same string already
  // happens to appear somewhere in the host's scanned files; these two
  // never did, so the table silently fell back to block layout (every
  // column stacking as its own line) with no error anywhere. Found live
  // 2026-08-05. Inline styles have no such dependency.
  const TASK_TABLE_GRID = { display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 90px minmax(160px,1fr) 60px 120px 70px 140px' };
  const RUN_HISTORY_GRID = { display: 'grid', gridTemplateColumns: '160px 70px 60px 1fr' };

  function fmtTime(epoch) {
    if (!epoch) return '—';
    const d = new Date(epoch * 1000);
    return d.toLocaleString();
  }

  function fmtRelative(epoch) {
    if (!epoch) return '—';
    const delta = Date.now() / 1000 - epoch;
    if (delta < 60) return `${Math.floor(delta)}s ago`;
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    return `${Math.floor(delta / 86400)}d ago`;
  }

  function StatusBadge({ status }) {
    const color =
      status === 'ok' ? 'bg-green-500/15 text-green-400' :
      status === 'error' ? 'bg-red-500/15 text-red-400' :
      status === 'running' ? 'bg-blue-500/15 text-blue-400' :
      'bg-white/5 text-[var(--color-text-muted)]';
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${color}`}>
        {status || '—'}
      </span>
    );
  }

  function summarizeSchedule(s) {
    if (!s) return '—';
    switch (s.kind) {
      case 'once': {
        try {
          return `Once · ${new Date(s.at).toLocaleString()}`;
        } catch { return `Once · ${s.at}`; }
      }
      case 'daily': return `Daily ${s.time}`;
      case 'weekly': {
        const days = (s.days || []).map((d) => DAY_NAMES[d] || d).join('/');
        return `Weekly ${days} ${s.time}`;
      }
      case 'monthly': return `Monthly day ${s.day_of_month} at ${s.time}`;
      case 'cron': return `Cron · ${s.expr}`;
      default: return JSON.stringify(s);
    }
  }

  function summarizeSchedules(schedules) {
    if (!schedules || !schedules.length) return '—';
    if (schedules.length === 1) return summarizeSchedule(schedules[0]);
    return `${schedules.length} schedules`;
  }

  function defaultForKind(kind) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hhmm = `${pad(now.getHours())}:${pad(Math.min(59, now.getMinutes()))}`;
    switch (kind) {
      case 'once': {
        const future = new Date(now.getTime() + 60 * 60 * 1000);
        const iso = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
        return { kind: 'once', at: iso };
      }
      case 'daily':   return { kind: 'daily', time: hhmm };
      case 'weekly':  return { kind: 'weekly', days: [0, 1, 2, 3, 4], time: hhmm };
      case 'monthly': return { kind: 'monthly', day_of_month: 1, time: hhmm };
      case 'cron':    return { kind: 'cron', expr: '0 9 * * *' };
      default:        return { kind: 'daily', time: hhmm };
    }
  }

  function inputClass(invalid) {
    return `bg-[var(--color-bg-primary)] border rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] ${
      invalid ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
    }`;
  }

  function ScheduleRow({ value, error, onChange, onRemove, nextFireAt }) {
    const k = value.kind;
    const setKind = (newKind) => onChange(defaultForKind(newKind));
    const patch = (p) => onChange({ ...value, ...p });

    return (
      <div className="border border-[var(--color-border)] rounded p-2 bg-[var(--color-bg-primary)]/40">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={k}
            onChange={(e) => setKind(e.target.value)}
            className={inputClass(false) + ' shrink-0'}
          >
            <option value="once">Once</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="cron">Cron (advanced)</option>
          </select>

          <span className="flex-1" />

          {nextFireAt && !error && (
            <span className="text-[10px] text-[var(--color-text-muted)] truncate">
              Next: <span className="font-mono text-[var(--color-accent)]">{fmtTime(nextFireAt)}</span>
            </span>
          )}

          <button
            onClick={onRemove}
            title="Remove schedule"
            className="p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>

        {k === 'once' && (
          <input
            type="datetime-local"
            value={value.at || ''}
            onChange={(e) => patch({ at: e.target.value })}
            className={inputClass(!!error) + ' w-full'}
          />
        )}

        {k === 'daily' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--color-text-muted)] w-12">at</span>
            <input
              type="time"
              value={value.time || ''}
              onChange={(e) => patch({ time: e.target.value })}
              className={inputClass(!!error)}
            />
          </div>
        )}

        {k === 'weekly' && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 flex-wrap">
              {DAY_NAMES.map((label, i) => {
                const active = (value.days || []).includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const days = new Set(value.days || []);
                      if (active) days.delete(i); else days.add(i);
                      patch({ days: [...days].sort((a, b) => a - b) });
                    }}
                    className={`px-2 py-1 text-[11px] rounded border ${
                      active
                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                        : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--color-text-muted)] w-12">at</span>
              <input
                type="time"
                value={value.time || ''}
                onChange={(e) => patch({ time: e.target.value })}
                className={inputClass(!!error)}
              />
            </div>
          </div>
        )}

        {k === 'monthly' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[var(--color-text-muted)]">on day</span>
            <input
              type="number" min={1} max={31}
              value={value.day_of_month ?? 1}
              onChange={(e) => patch({ day_of_month: Number(e.target.value) })}
              className={inputClass(!!error) + ' w-16'}
            />
            <span className="text-[11px] text-[var(--color-text-muted)]">at</span>
            <input
              type="time"
              value={value.time || ''}
              onChange={(e) => patch({ time: e.target.value })}
              className={inputClass(!!error)}
            />
          </div>
        )}

        {k === 'cron' && (
          <div>
            <input
              type="text"
              value={value.expr || ''}
              placeholder="0 9 * * *"
              onChange={(e) => patch({ expr: e.target.value })}
              className={inputClass(!!error) + ' w-full font-mono'}
            />
            <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
              5 fields: minute hour day-of-month month day-of-week. Examples:
              <span className="font-mono"> */15 * * * *</span>,{' '}
              <span className="font-mono">0 9 * * 1-5</span>,{' '}
              <span className="font-mono">@hourly</span>.
            </div>
          </div>
        )}

        {error && (
          <div className="text-[10px] text-[var(--color-danger)] mt-1">{error}</div>
        )}
      </div>
    );
  }

  function ScheduleEditor({ schedules, onChange }) {
    const [preview, setPreview] = useState(null);

    useEffect(() => {
      if (!schedules.length) { setPreview(null); return; }
      const t = setTimeout(async () => {
        try {
          const r = await host.sdk.api.fetch(host.app.apiUrl('/preview-schedules'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedules }),
          });
          const data = await r.json();
          setPreview(data);
        } catch {
          setPreview({ ok: false, entries: [], error: 'Network error' });
        }
      }, 300);
      return () => clearTimeout(t);
    }, [schedules]);

    const updateAt = (i, next) => {
      const out = schedules.slice();
      out[i] = next;
      onChange(out);
    };
    const removeAt = (i) => onChange(schedules.filter((_, k) => k !== i));
    const add = (kind) => onChange([...schedules, defaultForKind(kind)]);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Schedules</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {preview?.next_fire_at ? (
              <>Next fires: <span className="font-mono text-[var(--color-accent)]">{fmtTime(preview.next_fire_at)}</span></>
            ) : (
              schedules.length === 0 ? 'No schedule — runs only on manual ▶' : 'No upcoming fire'
            )}
          </span>
        </div>

        {schedules.map((s, i) => {
          const entry = preview?.entries?.find((e) => e.index === i);
          return (
            <ScheduleRow
              key={i}
              value={s}
              error={entry && !entry.ok ? entry.error : null}
              nextFireAt={entry?.next_fire_at}
              onChange={(next) => updateAt(i, next)}
              onRemove={() => removeAt(i)}
            />
          );
        })}

        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mr-1">Add:</span>
          {[
            ['once', 'Once'], ['daily', 'Daily'], ['weekly', 'Weekly'],
            ['monthly', 'Monthly'], ['cron', 'Cron'],
          ].map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => add(kind)}
              className="px-2 py-1 text-[11px] rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
            >
              + {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function ToggleSwitch({ checked, onChange, disabled, label, tone = 'danger' }) {
    const onColor = tone === 'ok'
      ? 'bg-green-500'
      : 'bg-[var(--color-danger)]';
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        title={label}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          disabled ? 'bg-white/5 cursor-not-allowed' :
          checked ? onColor : 'bg-white/10 hover:bg-white/15'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    );
  }

  function TaskEditor({ task, onClose, onSaved }) {
    const isNew = !task;
    const [name, setName] = useState(task?.name || '');
    const [prompt, setPrompt] = useState(task?.prompt || '');
    const [schedules, setSchedules] = useState(task?.schedules || []);
    const [enabled, setEnabled] = useState(task?.enabled ?? true);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const [taskType, setTaskType] = useState(task?.type || 'terminal');
    const [agentSlug, setAgentSlug] = useState(task?.agent_slug || '');
    const [reuseSession, setReuseSession] = useState(task?.reuse_session ?? false);
    const [command, setCommand] = useState(task?.command || '');
    const [notifyExitCodes, setNotifyExitCodes] = useState(task?.notify_exit_codes || '');
    const [apAgents, setApAgents] = useState([]);
    useEffect(() => {
      // This app's own GET /agents (tasks_app/routes.py) — server-side
      // proxies agents-platform's /api/agents using ctx.config's
      // agents_platform_base/token. Was previously pointed at the
      // monolith's /api/whatsapp/agent-picker, which was never ported to
      // aw-workspace and doesn't exist here — the picker was always empty.
      host.sdk.api.fetch(host.app.apiUrl('/agents'))
        .then((r) => r.json())
        .then((d) => setApAgents(d.ap_agents || []))
        .catch(() => setApAgents([]));
    }, []);

    const TYPE_LABELS = {
      terminal: 'Terminal',
      agent_prompt: 'Agent Prompt',
      agentic_output: 'Agentic Output',
    };

    const save = async () => {
      setError(null);
      if (!name.trim()) { setError('Name is required.'); return; }
      if (taskType === 'agent_prompt' && !agentSlug) { setError('Pick an agent.'); return; }
      if (taskType === 'agentic_output') {
        if (!command.trim()) { setError('Command is required.'); return; }
        if (!agentSlug) { setError('Pick an agent.'); return; }
      }
      setBusy(true);
      try {
        const url = isNew ? host.app.apiUrl('/tasks') : host.app.apiUrl(`/tasks/${encodeURIComponent(task.id)}`);
        const method = isNew ? 'POST' : 'PUT';
        const r = await host.sdk.api.fetch(url, {
          method, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            type: taskType,
            cli_type: 'terminal',
            prompt,
            schedules,
            enabled,
            agent_slug: agentSlug,
            reuse_session: reuseSession,
            command,
            notify_exit_codes: notifyExitCodes,
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          setError(data?.error || 'Save failed');
          return;
        }
        onSaved(data);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isNew ? 'New task' : `Edit task — ${task.name}`}
            </h2>
            <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg">×</button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Name</label>
              <input
                autoFocus value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daily standup digest"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
              />
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                The bound terminal session will be named <span className="font-mono">"Task: {name || '<name>'}"</span>.
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Type</label>
              <div className="flex rounded border border-[var(--color-border)] overflow-hidden w-fit">
                {['terminal', 'agent_prompt', 'agentic_output'].map((tt) => (
                  <button
                    key={tt} type="button"
                    onClick={() => setTaskType(tt)}
                    className={`px-3 py-1.5 text-xs border-r border-[var(--color-border)] last:border-r-0 ${
                      taskType === tt
                        ? 'bg-[var(--color-accent)] text-white font-semibold'
                        : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {TYPE_LABELS[tt]}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {taskType === 'terminal' && 'Runs a CLI/command in a reusable terminal session.'}
                {taskType === 'agent_prompt' && 'Calls an Agents Platform agent with the prompt.'}
                {taskType === 'agentic_output' && 'Runs a command; on a notable exit code, a Telegram bot’s agent interprets and reports the output.'}
              </div>
            </div>

            {taskType === 'terminal' && (<>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Command</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Shell command typed into the bash session, e.g. ./aw status"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
              />
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Runs in a plain bash terminal session. Lines are executed followed by Enter — supports pipes, multiple commands separated by <span className="font-mono">;</span> or <span className="font-mono">&&</span>.
              </div>
            </div>
            </>)}

            {taskType === 'agent_prompt' && (<>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Agent <span className="normal-case text-[var(--color-text-muted)]">(Agents Platform)</span></label>
              <select
                value={agentSlug}
                onChange={(e) => setAgentSlug(e.target.value)}
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
              >
                <option value="">— pick an agent —</option>
                {apAgents.map((a) => (
                  <option key={a.slug} value={a.slug}>{a.name || a.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="The prompt sent to the agent when this task runs."
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
              />
            </div>
            <div className="flex items-start gap-3">
              <ToggleSwitch checked={reuseSession} onChange={setReuseSession} label="Reuse session" tone="ok" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--color-text-primary)]">Reuse session</div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  First run creates the agent session; later runs resume it to keep context.
                </div>
              </div>
            </div>
            </>)}

            {taskType === 'agentic_output' && (<>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Command</label>
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                rows={3}
                placeholder="Cheap shell command to run first, e.g. a diff/check script — no LLM cost."
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
              />
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Runs on every fire. The agent below is only invoked when the exit code is notable — this is what keeps the type cheap.
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Notify on exit code</label>
              <input
                value={notifyExitCodes}
                onChange={(e) => setNotifyExitCodes(e.target.value)}
                placeholder="blank = any non-zero · or a list like 1,2,127"
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono"
              />
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Which exit codes count as "there's a difference" and trigger the agent below. Leave blank for any non-zero.
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Agent <span className="normal-case text-[var(--color-text-muted)]">(Agents Platform)</span></label>
              <select
                value={agentSlug}
                onChange={(e) => setAgentSlug(e.target.value)}
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
              >
                <option value="">— pick an agent —</option>
                {apAgents.map((a) => (
                  <option key={a.slug} value={a.slug}>{a.name || a.slug}</option>
                ))}
              </select>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Only invoked on a notable exit code — with your prompt below plus the command's captured output appended.
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="Instructions for the agent — what to do with the command's output when there's a difference."
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
              />
            </div>
            <div className="flex items-start gap-3">
              <ToggleSwitch checked={reuseSession} onChange={setReuseSession} label="Reuse session" tone="ok" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--color-text-primary)]">Reuse session</div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  First triggered run creates the agent session; later runs resume it to keep context.
                </div>
              </div>
            </div>
            </>)}

            <ScheduleEditor schedules={schedules} onChange={setSchedules} />

            <div className="flex items-start gap-3">
              <ToggleSwitch
                checked={enabled}
                onChange={setEnabled}
                label="Enabled"
                tone="ok"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--color-text-primary)]">Enabled</div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  When off, scheduled fires are skipped. Manual ▶ Run-now still works.
                </div>
              </div>
            </div>

            {error && (
              <div className="px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >Cancel</button>
            <button
              onClick={save}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 disabled:opacity-50"
            >
              {busy ? 'Saving…' : isNew ? 'Create task' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function PresentationMiniature({ presentation, hideTaskTags, onClick }) {
    const iframeRef = useRef(null);
    const wrapperRef = useRef(null);
    const [scale, setScale] = useState(0.18);
    const REAL_W = 1000;
    const REAL_H = 650;
    const ASPECT = REAL_H / REAL_W;

    useEffect(() => {
      const el = wrapperRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) setScale(w / REAL_W);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe || !presentation?.html) return;
      try {
        const doc = iframe.contentDocument;
        doc.open();
        const responsive = `<style>html,body{margin:0;padding:0;overflow:hidden;}*{max-width:100%;box-sizing:border-box;}</style>`;
        let html = presentation.html;
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        html = html.replace(/\s+on\w+="[^"]*"/gi, '');
        html = html.replace(/\s+on\w+='[^']*'/gi, '');
        if (html.includes('<head>')) html = html.replace('<head>', '<head>' + responsive);
        else if (html.includes('<html>')) html = html.replace('<html>', '<html><head>' + responsive + '</head>');
        else html = responsive + html;
        doc.write(html);
        doc.close();
      } catch (_) { /* sandbox restrictions */ }
    }, [presentation?.html]);

    const otherTags = (presentation.tags || []).filter((t) => !hideTaskTags || !hideTaskTags.has(t));

    return (
      <div
        onClick={onClick}
        className="group rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden cursor-pointer hover:border-[var(--color-accent)] transition-colors"
        title={presentation.title || presentation.id}
      >
        <div
          ref={wrapperRef}
          className="relative bg-[var(--color-bg-primary)]"
          style={{ width: '100%', paddingTop: `${ASPECT * 100}%`, overflow: 'hidden' }}
        >
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            tabIndex={-1}
            aria-hidden
            style={{
              position: 'absolute', top: 0, left: 0,
              width: REAL_W, height: REAL_H, border: 0,
              pointerEvents: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
        <div className="px-2 py-1.5 border-t border-[var(--color-border)]">
          <div className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">
            {presentation.title || 'Untitled'}
          </div>
          {otherTags.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-0.5 overflow-hidden" style={{ maxHeight: 16 }}>
              {otherTags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[8px] font-mono leading-none px-1 py-[2px] rounded bg-white/5 border border-white/10 text-[var(--color-text-muted)] truncate"
                  title={t}
                >
                  {t}
                </span>
              ))}
              {otherTags.length > 3 && (
                <span className="text-[8px] leading-none px-1 py-[2px] text-[var(--color-text-muted)]" title={otherTags.slice(3).join(', ')}>
                  +{otherTags.length - 3}
                </span>
              )}
            </div>
          )}
          <div className="text-[9px] text-[var(--color-text-muted)] truncate mt-0.5">
            {fmtTime(presentation.created_at)}
          </div>
        </div>
      </div>
    );
  }

  function GeneratedAssets({ task, presentations }) {
    const open = (cid) => {
      window.__awOpenPresentation?.(cid);
    };

    if (!presentations || presentations.length === 0) {
      return (
        <div className="px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic border-t border-[var(--color-border)]">
          No generated assets yet. Presentations produced inside this task's bound session
          are tagged <span className="font-mono">task:{task.id}</span> automatically.
        </div>
      );
    }
    const hideTags = new Set([`task:${task.id}`]);
    if (task.name && task.name !== task.id) hideTags.add(`task:${task.name}`);
    return (
      <div className="border-t border-[var(--color-border)]">
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)]/40">
          Generated assets ({presentations.length})
        </div>
        <div className="flex gap-2 p-3 overflow-x-auto overflow-y-hidden">
          {presentations.map((c) => (
            <div key={c.id} className="shrink-0" style={{ width: 200 }}>
              <PresentationMiniature presentation={c} hideTaskTags={hideTags} onClick={() => open(c.id)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  function RunHistory({ task, onOpen }) {
    const runs = task.runs || [];
    if (!runs.length) {
      return (
        <div className="px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic">
          No runs yet.
        </div>
      );
    }
    return (
      <div className="border-t border-[var(--color-border)]">
        {runs.map((r) => (
          <div
            key={r.id}
            onClick={onOpen}
            style={RUN_HISTORY_GRID}
            className="items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-white/[0.03] cursor-pointer"
            title="Click to open this task's agent session"
          >
            <span className="font-mono text-[var(--color-text-muted)]">{fmtTime(r.started_at)}</span>
            <span className="text-[var(--color-text-muted)]">{r.trigger}</span>
            <StatusBadge status={r.status} />
            <span className="font-mono text-[var(--color-text-muted)] truncate">
              {r.error || ''}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function TasksWindowBody() {
    const [tasks, setTasks] = useState([]);
    const [editing, setEditing] = useState(null);
    const [expanded, setExpanded] = useState({});
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
      try {
        const r = await host.sdk.api.fetch(host.app.apiUrl('/tasks'));
        const data = await r.json();
        setTasks(data.tasks || []);
      } catch (e) {
        setError(String(e));
      }
    }, []);

    useEffect(() => {
      reload();
    }, [reload]);

    useEffect(() => {
      const handler = () => reload();
      window.addEventListener('aw-task-update', handler);
      return () => window.removeEventListener('aw-task-update', handler);
    }, [reload]);

    const [presentationsByTask, setPresentationsByTask] = useState({});
    const reloadPresentations = useCallback(async () => {
      try {
        const r = await host.sdk.api.fetch('/api/apps/presentations/presentations');
        const all = await r.json();
        const groups = {};
        const seen = {};
        for (const c of (Array.isArray(all) ? all : [])) {
          const keys = new Set();
          for (const tag of (c.tags || [])) {
            if (typeof tag === 'string' && tag.startsWith('task:')) {
              keys.add(tag.slice(5));
            }
          }
          for (const k of keys) {
            if (!seen[k]) seen[k] = new Set();
            if (seen[k].has(c.id)) continue;
            seen[k].add(c.id);
            (groups[k] = groups[k] || []).push(c);
          }
        }
        for (const k of Object.keys(groups)) {
          groups[k].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        }
        setPresentationsByTask(groups);
      } catch (_) { /* swallow — column just shows 0 */ }
    }, []);

    const presentationsForTask = useCallback((t) => {
      const byId = presentationsByTask[t.id] || [];
      const byName = (t.name && t.name !== t.id) ? (presentationsByTask[t.name] || []) : [];
      if (!byName.length) return byId;
      if (!byId.length) return byName;
      const seenIds = new Set(byId.map((c) => c.id));
      const merged = [...byId];
      for (const c of byName) {
        if (!seenIds.has(c.id)) merged.push(c);
      }
      merged.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      return merged;
    }, [presentationsByTask]);
    useEffect(() => { reloadPresentations(); }, [reloadPresentations]);
    useEffect(() => {
      const handler = () => reloadPresentations();
      window.addEventListener('aw-presentation-update', handler);
      return () => window.removeEventListener('aw-presentation-update', handler);
    }, [reloadPresentations]);

    const rowRefs = useRef({});
    useEffect(() => {
      const handler = (e) => {
        const tid = e.detail?.taskId;
        if (!tid) return;
        setExpanded((p) => ({ ...p, [tid]: true }));
        setTimeout(() => {
          const el = rowRefs.current[tid];
          if (el && el.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 60);
      };
      window.addEventListener('aw-focus-task', handler);
      return () => window.removeEventListener('aw-focus-task', handler);
    }, []);

    const runNow = async (id) => {
      try {
        await host.sdk.api.fetch(host.app.apiUrl(`/tasks/${encodeURIComponent(id)}/run`), { method: 'POST' });
        reload();
      } catch (e) {
        setError(String(e));
      }
    };

    const remove = async (id) => {
      if (!confirm('Delete this task and its bound terminal session?')) return;
      try {
        await host.sdk.api.fetch(host.app.apiUrl(`/tasks/${encodeURIComponent(id)}`), { method: 'DELETE' });
        reload();
      } catch (e) {
        setError(String(e));
      }
    };

    const toggleEnabled = async (task) => {
      try {
        await host.sdk.api.fetch(host.app.apiUrl(`/tasks/${encodeURIComponent(task.id)}`), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !task.enabled }),
        });
        reload();
      } catch (e) {
        setError(String(e));
      }
    };

    // The aw-app-tasks port doesn't carry the monolith's /open route yet (no
    // agent-session-id-open machinery — see the app's manager.py docstring),
    // so this button stays disabled below rather than call a route that 404s.
    const openSession = async (_task) => {};

    return (
      <div className="p-4 w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Scheduled Tasks</h1>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Each task fires its prompt into a single reusable CLI session named "Task: {`<name>`}".
            </p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25"
          >
            + New task
          </button>
        </div>

        {error && (
          <div className="mb-3 px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30">
            {error}
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="px-3 py-12 text-center text-xs text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-border)] rounded">
            No tasks yet. Click "+ New task" to create one.
          </div>
        ) : (
          <div className="border border-[var(--color-border)] rounded overflow-hidden">
            <div style={TASK_TABLE_GRID} className="items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)] border-b border-[var(--color-border)]">
              <span>Name</span>
              <span>CLI</span>
              <span>Schedule</span>
              <span>On</span>
              <span>Last run</span>
              <span>Presentation</span>
              <span className="text-right">Actions</span>
            </div>

            {tasks.map((t) => {
              const isExpanded = !!expanded[t.id];
              const summary = summarizeSchedules(t.schedules);
              return (
                <div
                  key={t.id}
                  ref={(el) => { if (el) rowRefs.current[t.id] = el; else delete rowRefs.current[t.id]; }}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <div style={TASK_TABLE_GRID} className="items-center gap-2 px-3 py-2 hover:bg-white/[0.02]">
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [t.id]: !isExpanded }))}
                      className="flex items-center gap-1.5 text-left min-w-0"
                    >
                      <span className="text-[var(--color-text-muted)] text-[10px] w-2.5">{isExpanded ? '▼' : '▶'}</span>
                      <span className="text-xs text-[var(--color-text-primary)] truncate">{t.name}</span>
                      {t.agent_session_id && (
                        <span
                          className="text-[9px] font-mono text-[var(--color-text-muted)] shrink-0"
                          title={`Agent conversation: ${t.agent_session_id}`}
                        >
                          {t.agent_session_id.length > 12 ? t.agent_session_id.slice(0, 8) : t.agent_session_id}
                        </span>
                      )}
                    </button>
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)] truncate flex items-center gap-1">
                      {t.type === 'agent_prompt' || t.type === 'agentic_output'
                        ? `agent:${t.agent_slug || '?'}`
                        : t.cli_type}
                    </span>
                    <span
                      className="text-[11px] text-[var(--color-text-muted)] truncate"
                      title={(t.schedules || []).map(summarizeSchedule).join('\n') || '—'}
                    >
                      {summary}
                    </span>
                    <button
                      onClick={() => toggleEnabled(t)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        t.enabled
                          ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                          : 'bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10'
                      }`}
                      title={t.enabled ? 'Disable' : 'Enable'}
                    >
                      {t.enabled ? 'on' : 'off'}
                    </button>
                    <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
                      <StatusBadge status={t.last_run_status} />
                      <span title={fmtTime(t.last_run_at)}>{fmtRelative(t.last_run_at)}</span>
                    </span>
                    {(() => {
                      const cnt = presentationsForTask(t).length;
                      return (
                        <button
                          onClick={() => setExpanded((p) => ({ ...p, [t.id]: !isExpanded }))}
                          title={cnt > 0 ? `${cnt} presentation${cnt === 1 ? '' : 'es'} — click to expand` : 'No presentations for this task'}
                          disabled={cnt === 0}
                          className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                            cnt > 0
                              ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 cursor-pointer'
                              : 'text-[var(--color-text-muted)] opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M3 9h18M9 3v18" />
                          </svg>
                          <span className="font-mono">{cnt}</span>
                        </button>
                      );
                    })()}
                    <span className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => runNow(t.id)}
                        title="Run now"
                        className="p-1 rounded hover:bg-white/10 text-green-400"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      </button>
                      <button
                        onClick={() => openSession(t)}
                        title="Opening a task's bound session isn't ported yet"
                        disabled
                        className="p-1 rounded hover:bg-white/10 text-amber-400 disabled:opacity-30"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="4 17 10 11 4 5" />
                          <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditing(t)}
                        title="Edit"
                        className="p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        title="Delete"
                        className="p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </span>
                  </div>

                  {isExpanded && (
                    <>
                      <RunHistory task={t} onOpen={() => openSession(t)} />
                      <GeneratedAssets task={t} presentations={presentationsForTask(t)} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {editing && (
          <TaskEditor
            task={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); reload(); }}
          />
        )}
      </div>
    );
  }

  host.registerSlot('core.nav.workspace', TasksNavSlot);
  host.registerWindow('tasks.main', TasksWindowBody);
}

export default register;
