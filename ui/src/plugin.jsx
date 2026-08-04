// Integrated-mode entrypoint — dynamic-imported by aw-workspace-ui's
// loadComponentPlugin() (src/apps/loadPlugin.js) once this app is installed
// with "ui:code" + "ui:slots:core.nav.workspace" granted. Built by
// `npm run build` -> ui/dist/tasks.js, referenced from aw-app.json's
// contributes.frontend.bundle.
//
// register(host) is the ONE required export. `host` is the APP-SCOPED handle
// from aw-workspace-ui's hostForApp() (src/apps/pluginHost.js) — host.React /
// host.h are the shared instances (never import your own React), host.app.*
// are this app's own `/api/apps/tasks/...` helpers, host.registerSlot is how
// this fills the `core.nav.workspace` slot WorkspaceNav.jsx renders inside
// its "Workspace" popover (alongside Settings/Repos/Debugger/...).
//
// JSX in this file compiles to host.h(...)/host.React.Fragment calls, not
// react's own createElement — see vite.config.js's esbuild.jsxFactory. Every
// component below is a plain function DECLARED INSIDE register(host) so it
// closes over `host` without importing react itself (ADR "one shared React
// instance" — external: ['react','react-dom'] in vite.config.js).
//
// Ports the "Tasks" row out of aw-workspace-ui's WorkspaceNav.jsx (hardcoded
// hover-flyout task list) into this app, mirroring the 2026-08-03 decision
// that moved the Agents nav menu into aw-app-code-agent-clis. "Open all →"
// reuses window.__awOpenTasksPanel — the global hook App.jsx already exposes
// for the full CRUD floating window (TasksTab.jsx) — this component only
// owns the compact row + quick-glance flyout, not the create/edit dialog.

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
      window.__awOpenTasksPanel?.();
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

  host.registerSlot('core.nav.workspace', TasksNavSlot);
}

export default register;
