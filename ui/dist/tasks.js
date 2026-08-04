function S({ apiUrl: e, fetchImpl: c = fetch }) {
  async function o() {
    const a = await c(e("/tasks"));
    if (!a.ok) throw new Error(`GET /tasks -> ${a.status}`);
    return (await a.json()).tasks || [];
  }
  async function p(a) {
    const s = await c(e(`/tasks/${encodeURIComponent(a)}/run`), { method: "POST" }), i = await s.json().catch(() => ({}));
    if (!s.ok) throw new Error(i.detail || i.error || `POST /tasks/${a}/run -> ${s.status}`);
    return i;
  }
  return { listTasks: o, runTask: p };
}
function $(e) {
  const c = S({
    apiUrl: e.app.apiUrl,
    fetchImpl: e.sdk.api.fetch
  }), { useState: o, useRef: p, useCallback: a, useEffect: s } = e.React;
  function i() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ e.h("polyline", { points: "12 6 12 12 16 14" }));
  }
  function w() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3 h-3", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ e.h("path", { d: "M8 5v14l11-7z" }));
  }
  function g(m) {
    const n = m.schedules || [];
    if (n.length === 0) return "manual";
    if (n.length > 1) return `${n.length} schedules`;
    const r = n[0];
    return r.kind === "cron" ? r.expr || "cron" : r.kind || "scheduled";
  }
  function f() {
    const [m, n] = o(!1), [r, y] = o([]), [v, d] = o(null), [b, h] = o(null), x = p(null), l = a(async () => {
      try {
        y(await c.listTasks()), d(null);
      } catch (t) {
        d(String(t.message || t));
      }
    }, []);
    s(() => {
      l();
      const t = () => l();
      return window.addEventListener("aw-task-update", t), () => window.removeEventListener("aw-task-update", t);
    }, [l]), s(() => () => clearTimeout(x.current), []);
    const N = a(() => {
      clearTimeout(x.current), n(!0), l();
    }, [l]), T = a(() => {
      x.current = setTimeout(() => n(!1), 150);
    }, []), k = a(() => {
      var t;
      n(!1), (t = window.__awOpenTasksPanel) == null || t.call(window);
    }, []), C = a(async (t) => {
      h(t.id), d(null);
      try {
        await c.runTask(t.id), await l();
      } catch (u) {
        d(`${t.name}: ${u.message || u}`);
      } finally {
        h(null);
      }
    }, [l]);
    return /* @__PURE__ */ e.h("div", { className: "relative", onMouseEnter: N, onMouseLeave: T }, /* @__PURE__ */ e.h(
      "div",
      {
        onClick: k,
        className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer"
      },
      /* @__PURE__ */ e.h(i, null),
      /* @__PURE__ */ e.h("span", { className: "flex-1 text-[13px] text-[var(--color-text-primary)]" }, "Tasks"),
      r.length > 0 && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)]" }, r.length),
      /* @__PURE__ */ e.h("svg", { className: "w-3 h-3 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M9 6l6 6-6 6" }))
    ), m && /* @__PURE__ */ e.h(
      "div",
      {
        className: "absolute left-full top-0 ml-1 z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-2",
        style: { minWidth: 320, maxWidth: 420 }
      },
      /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between px-2 py-1 mb-1" }, /* @__PURE__ */ e.h("span", { className: "text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" }, "Tasks · ", r.length), /* @__PURE__ */ e.h(
        "button",
        {
          onClick: k,
          className: "text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors",
          title: "Open Tasks window"
        },
        "Open all →"
      )),
      v && /* @__PURE__ */ e.h("div", { className: "mx-1 mb-2 px-2 py-1 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, v),
      r.length === 0 ? /* @__PURE__ */ e.h("div", { className: "px-3 py-6 text-center text-xs text-[var(--color-text-muted)] italic" }, 'No tasks yet. Click "Open all →" to create one.') : /* @__PURE__ */ e.h("div", { className: "overflow-y-auto", style: { maxHeight: "70vh" } }, r.map((t) => {
        const u = b === t.id, _ = t.last_run_status === "ok" ? "bg-green-400" : t.last_run_status === "error" ? "bg-red-400" : t.last_run_status === "running" ? "bg-blue-400" : "bg-white/20";
        return /* @__PURE__ */ e.h(
          "div",
          {
            key: t.id,
            className: "group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.05]",
            title: t.name
          },
          /* @__PURE__ */ e.h("span", { className: `w-1.5 h-1.5 rounded-full shrink-0 ${_}` }),
          /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ e.h("span", { className: "text-[13px] text-[var(--color-text-primary)] truncate" }, t.name), !t.enabled && /* @__PURE__ */ e.h("span", { className: "px-1 py-0.5 rounded text-[9px] bg-white/5 text-[var(--color-text-muted)] shrink-0" }, "off")), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] truncate font-mono" }, t.type === "agent_prompt" || t.type === "agentic_output" ? t.type : t.cli_type, " · ", g(t))),
          /* @__PURE__ */ e.h(
            "button",
            {
              onClick: (E) => {
                E.stopPropagation(), C(t);
              },
              disabled: u,
              className: "p-1 rounded hover:bg-white/10 text-green-400 disabled:opacity-50 shrink-0",
              title: "Run now"
            },
            u ? /* @__PURE__ */ e.h("svg", { className: "w-3 h-3 animate-spin", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10", opacity: "0.25" }), /* @__PURE__ */ e.h("path", { d: "M4 12a8 8 0 0 1 8-8" })) : /* @__PURE__ */ e.h(w, null)
          )
        );
      }))
    ));
  }
  e.registerSlot("core.nav.workspace", f);
}
export {
  $ as default,
  $ as register
};
