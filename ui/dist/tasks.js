function ve({ apiUrl: e, fetchImpl: O = fetch }) {
  async function v() {
    const _ = await O(e("/tasks"));
    if (!_.ok) throw new Error(`GET /tasks -> ${_.status}`);
    return (await _.json()).tasks || [];
  }
  async function A(_) {
    const N = await O(e(`/tasks/${encodeURIComponent(_)}/run`), { method: "POST" }), E = await N.json().catch(() => ({}));
    if (!N.ok) throw new Error(E.detail || E.error || `POST /tasks/${_}/run -> ${N.status}`);
    return E;
  }
  return { listTasks: v, runTask: A };
}
function ge(e) {
  var J;
  const O = ve({
    apiUrl: e.app.apiUrl,
    fetchImpl: e.sdk.api.fetch
  }), { useState: v, useRef: A, useCallback: _, useEffect: N } = e.React;
  let E = null;
  const j = /* @__PURE__ */ new Set(), W = (J = e.sdk.ws) == null ? void 0 : J.createSharedSocket;
  W || console.warn("[tasks] host.sdk.ws.createSharedSocket is unavailable (SPA too old for aw-ws/1 §9.1) — live task updates disabled, falling back to REST-only.");
  const q = W ? W({
    url: () => e.app.wsUrl("/ws/updates"),
    initType: "tasks_init",
    onFrame: (t) => {
      t.type === "tasks_update" && window.dispatchEvent(new CustomEvent("aw-task-update", { detail: t.data }));
    },
    onStatus: ({ state: t, message: r }) => {
      if (t === "fatal") E = r;
      else if (t === "open") E = null;
      else return;
      for (const n of j) n(E);
    }
  }) : { retain: () => () => {
  } };
  function B(t) {
    N(() => q.retain(), []), N(() => {
      const r = () => t();
      return window.addEventListener("aw-task-update", r), () => window.removeEventListener("aw-task-update", r);
    }, [t]);
  }
  function Q() {
    const [t, r] = v(E);
    return N(() => (j.add(r), r(E), () => j.delete(r)), []), t;
  }
  function X() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ e.h("polyline", { points: "12 6 12 12 16 14" }));
  }
  function Z() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3 h-3", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ e.h("path", { d: "M8 5v14l11-7z" }));
  }
  function ee(t) {
    const r = t.schedules || [];
    if (r.length === 0) return "manual";
    if (r.length > 1) return `${r.length} schedules`;
    const n = r[0];
    return n.kind === "cron" ? n.expr || "cron" : n.kind || "scheduled";
  }
  function te() {
    const [t, r] = v(!1), [n, s] = v([]), [d, p] = v(null), [C, c] = v(null), l = A(null), m = _(async () => {
      try {
        s(await O.listTasks()), p(null);
      } catch (o) {
        p(String(o.message || o));
      }
    }, []);
    N(() => {
      m();
    }, [m]), B(m), N(() => () => clearTimeout(l.current), []);
    const h = _(() => {
      clearTimeout(l.current), r(!0), m();
    }, [m]), g = _(() => {
      l.current = setTimeout(() => r(!1), 150);
    }, []), f = _(() => {
      var o;
      r(!1), (o = window.__awOpenAppWindow) == null || o.call(window, "tasks.main");
    }, []), y = _(async (o) => {
      c(o.id), p(null);
      try {
        await O.runTask(o.id), await m();
      } catch ($) {
        p(`${o.name}: ${$.message || $}`);
      } finally {
        c(null);
      }
    }, [m]);
    return /* @__PURE__ */ e.h("div", { className: "relative", onMouseEnter: h, onMouseLeave: g }, /* @__PURE__ */ e.h(
      "div",
      {
        onClick: f,
        className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer"
      },
      /* @__PURE__ */ e.h(X, null),
      /* @__PURE__ */ e.h("span", { className: "flex-1 text-[13px] text-[var(--color-text-primary)]" }, "Tasks"),
      n.length > 0 && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)]" }, n.length),
      /* @__PURE__ */ e.h("svg", { className: "w-3 h-3 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M9 6l6 6-6 6" }))
    ), t && /* @__PURE__ */ e.h(
      "div",
      {
        className: "absolute left-full top-0 ml-1 z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-2",
        style: { minWidth: 320, maxWidth: 420 }
      },
      /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between px-2 py-1 mb-1" }, /* @__PURE__ */ e.h("span", { className: "text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" }, "Tasks · ", n.length), /* @__PURE__ */ e.h(
        "button",
        {
          onClick: f,
          className: "text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors",
          title: "Open Tasks window"
        },
        "Open all →"
      )),
      d && /* @__PURE__ */ e.h("div", { className: "mx-1 mb-2 px-2 py-1 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, d),
      n.length === 0 ? /* @__PURE__ */ e.h("div", { className: "px-3 py-6 text-center text-xs text-[var(--color-text-muted)] italic" }, 'No tasks yet. Click "Open all →" to create one.') : /* @__PURE__ */ e.h("div", { className: "overflow-y-auto", style: { maxHeight: "70vh" } }, n.map((o) => {
        const $ = C === o.id, T = o.last_run_status === "ok" ? "bg-green-400" : o.last_run_status === "error" ? "bg-red-400" : o.last_run_status === "running" ? "bg-blue-400" : "bg-white/20";
        return /* @__PURE__ */ e.h(
          "div",
          {
            key: o.id,
            className: "group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.05]",
            title: o.name
          },
          /* @__PURE__ */ e.h("span", { className: `w-1.5 h-1.5 rounded-full shrink-0 ${T}` }),
          /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ e.h("span", { className: "text-[13px] text-[var(--color-text-primary)] truncate" }, o.name), !o.enabled && /* @__PURE__ */ e.h("span", { className: "px-1 py-0.5 rounded text-[9px] bg-white/5 text-[var(--color-text-muted)] shrink-0" }, "off")), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] truncate font-mono" }, o.type === "agent_prompt" || o.type === "agentic_output" ? o.type : o.cli_type, " · ", ee(o))),
          /* @__PURE__ */ e.h(
            "button",
            {
              onClick: (P) => {
                P.stopPropagation(), y(o);
              },
              disabled: $,
              className: "p-1 rounded hover:bg-white/10 text-green-400 disabled:opacity-50 shrink-0",
              title: "Run now"
            },
            $ ? /* @__PURE__ */ e.h("svg", { className: "w-3 h-3 animate-spin", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10", opacity: "0.25" }), /* @__PURE__ */ e.h("path", { d: "M4 12a8 8 0 0 1 8-8" })) : /* @__PURE__ */ e.h(Z, null)
          )
        );
      }))
    ));
  }
  const D = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], F = { display: "grid", gridTemplateColumns: "minmax(160px,1fr) 90px minmax(160px,1fr) 60px 120px 70px 140px" }, ae = { display: "grid", gridTemplateColumns: "160px 70px 60px 1fr" };
  function L(t) {
    return t ? new Date(t * 1e3).toLocaleString() : "—";
  }
  function re(t) {
    if (!t) return "—";
    const r = Date.now() / 1e3 - t;
    return r < 60 ? `${Math.floor(r)}s ago` : r < 3600 ? `${Math.floor(r / 60)}m ago` : r < 86400 ? `${Math.floor(r / 3600)}h ago` : `${Math.floor(r / 86400)}d ago`;
  }
  function z({ status: t }) {
    const r = t === "ok" ? "bg-green-500/15 text-green-400" : t === "error" ? "bg-red-500/15 text-red-400" : t === "running" ? "bg-blue-500/15 text-blue-400" : "bg-white/5 text-[var(--color-text-muted)]";
    return /* @__PURE__ */ e.h("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-mono ${r}` }, t || "—");
  }
  function H(t) {
    if (!t) return "—";
    switch (t.kind) {
      case "once":
        try {
          return `Once · ${new Date(t.at).toLocaleString()}`;
        } catch {
          return `Once · ${t.at}`;
        }
      case "daily":
        return `Daily ${t.time}`;
      case "weekly":
        return `Weekly ${(t.days || []).map((n) => D[n] || n).join("/")} ${t.time}`;
      case "monthly":
        return `Monthly day ${t.day_of_month} at ${t.time}`;
      case "cron":
        return `Cron · ${t.expr}`;
      default:
        return JSON.stringify(t);
    }
  }
  function ne(t) {
    return !t || !t.length ? "—" : t.length === 1 ? H(t[0]) : `${t.length} schedules`;
  }
  function G(t) {
    const r = /* @__PURE__ */ new Date(), n = (d) => String(d).padStart(2, "0"), s = `${n(r.getHours())}:${n(Math.min(59, r.getMinutes()))}`;
    switch (t) {
      case "once": {
        const d = new Date(r.getTime() + 36e5);
        return { kind: "once", at: `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}T${n(d.getHours())}:${n(d.getMinutes())}` };
      }
      case "daily":
        return { kind: "daily", time: s };
      case "weekly":
        return { kind: "weekly", days: [0, 1, 2, 3, 4], time: s };
      case "monthly":
        return { kind: "monthly", day_of_month: 1, time: s };
      case "cron":
        return { kind: "cron", expr: "0 9 * * *" };
      default:
        return { kind: "daily", time: s };
    }
  }
  function M(t) {
    return `bg-[var(--color-bg-primary)] border rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] ${t ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`;
  }
  function oe({ value: t, error: r, onChange: n, onRemove: s, nextFireAt: d }) {
    const p = t.kind, C = (l) => n(G(l)), c = (l) => n({ ...t, ...l });
    return /* @__PURE__ */ e.h("div", { className: "border border-[var(--color-border)] rounded p-2 bg-[var(--color-bg-primary)]/40" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2 mb-2" }, /* @__PURE__ */ e.h(
      "select",
      {
        value: p,
        onChange: (l) => C(l.target.value),
        className: M(!1) + " shrink-0"
      },
      /* @__PURE__ */ e.h("option", { value: "once" }, "Once"),
      /* @__PURE__ */ e.h("option", { value: "daily" }, "Daily"),
      /* @__PURE__ */ e.h("option", { value: "weekly" }, "Weekly"),
      /* @__PURE__ */ e.h("option", { value: "monthly" }, "Monthly"),
      /* @__PURE__ */ e.h("option", { value: "cron" }, "Cron (advanced)")
    ), /* @__PURE__ */ e.h("span", { className: "flex-1" }), d && !r && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)] truncate" }, "Next: ", /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-accent)]" }, L(d))), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: s,
        title: "Remove schedule",
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] shrink-0"
      },
      /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ e.h("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }))
    )), p === "once" && /* @__PURE__ */ e.h(
      "input",
      {
        type: "datetime-local",
        value: t.at || "",
        onChange: (l) => c({ at: l.target.value }),
        className: M(!!r) + " w-full"
      }
    ), p === "daily" && /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] w-12" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (l) => c({ time: l.target.value }),
        className: M(!!r)
      }
    )), p === "weekly" && /* @__PURE__ */ e.h("div", { className: "space-y-2" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1 flex-wrap" }, D.map((l, m) => {
      const h = (t.days || []).includes(m);
      return /* @__PURE__ */ e.h(
        "button",
        {
          key: m,
          type: "button",
          onClick: () => {
            const g = new Set(t.days || []);
            h ? g.delete(m) : g.add(m), c({ days: [...g].sort((f, y) => f - y) });
          },
          className: `px-2 py-1 text-[11px] rounded border ${h ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30" : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-white/5"}`
        },
        l
      );
    })), /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] w-12" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (l) => c({ time: l.target.value }),
        className: M(!!r)
      }
    ))), p === "monthly" && /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "on day"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "number",
        min: 1,
        max: 31,
        value: t.day_of_month ?? 1,
        onChange: (l) => c({ day_of_month: Number(l.target.value) }),
        className: M(!!r) + " w-16"
      }
    ), /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (l) => c({ time: l.target.value }),
        className: M(!!r)
      }
    )), p === "cron" && /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h(
      "input",
      {
        type: "text",
        value: t.expr || "",
        placeholder: "0 9 * * *",
        onChange: (l) => c({ expr: l.target.value }),
        className: M(!!r) + " w-full font-mono"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "5 fields: minute hour day-of-month month day-of-week. Examples:", /* @__PURE__ */ e.h("span", { className: "font-mono" }, " */15 * * * *"), ",", " ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "0 9 * * 1-5"), ",", " ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "@hourly"), ".")), r && /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-danger)] mt-1" }, r));
  }
  function le({ schedules: t, onChange: r }) {
    const [n, s] = v(null);
    N(() => {
      if (!t.length) {
        s(null);
        return;
      }
      const c = setTimeout(async () => {
        try {
          const m = await (await e.sdk.api.fetch(e.app.apiUrl("/preview-schedules"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ schedules: t })
          })).json();
          s(m);
        } catch {
          s({ ok: !1, entries: [], error: "Network error" });
        }
      }, 300);
      return () => clearTimeout(c);
    }, [t]);
    const d = (c, l) => {
      const m = t.slice();
      m[c] = l, r(m);
    }, p = (c) => r(t.filter((l, m) => m !== c)), C = (c) => r([...t, G(c)]);
    return /* @__PURE__ */ e.h("div", { className: "space-y-2" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" }, "Schedules"), /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)]" }, n != null && n.next_fire_at ? /* @__PURE__ */ e.h(e.React.Fragment, null, "Next fires: ", /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-accent)]" }, L(n.next_fire_at))) : t.length === 0 ? "No schedule — runs only on manual ▶" : "No upcoming fire")), t.map((c, l) => {
      var h;
      const m = (h = n == null ? void 0 : n.entries) == null ? void 0 : h.find((g) => g.index === l);
      return /* @__PURE__ */ e.h(
        oe,
        {
          key: l,
          value: c,
          error: m && !m.ok ? m.error : null,
          nextFireAt: m == null ? void 0 : m.next_fire_at,
          onChange: (g) => d(l, g),
          onRemove: () => p(l)
        }
      );
    }), /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5 flex-wrap pt-1" }, /* @__PURE__ */ e.h("span", { className: "text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mr-1" }, "Add:"), [
      ["once", "Once"],
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
      ["cron", "Cron"]
    ].map(([c, l]) => /* @__PURE__ */ e.h(
      "button",
      {
        key: c,
        type: "button",
        onClick: () => C(c),
        className: "px-2 py-1 text-[11px] rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
      },
      "+ ",
      l
    ))));
  }
  function I({ checked: t, onChange: r, disabled: n, label: s, tone: d = "danger" }) {
    const p = d === "ok" ? "bg-green-500" : "bg-[var(--color-danger)]";
    return /* @__PURE__ */ e.h(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": t,
        disabled: n,
        onClick: () => !n && r(!t),
        title: s,
        className: `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${n ? "bg-white/5 cursor-not-allowed" : t ? p : "bg-white/10 hover:bg-white/15"}`
      },
      /* @__PURE__ */ e.h(
        "span",
        {
          className: `inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${t ? "translate-x-[18px]" : "translate-x-0.5"}`
        }
      )
    );
  }
  function se({ task: t, onClose: r, onSaved: n }) {
    const s = !t, [d, p] = v((t == null ? void 0 : t.name) || ""), [C, c] = v((t == null ? void 0 : t.prompt) || ""), [l, m] = v((t == null ? void 0 : t.schedules) || []), [h, g] = v((t == null ? void 0 : t.enabled) ?? !0), [f, y] = v(null), [o, $] = v(!1), [T, P] = v((t == null ? void 0 : t.type) || "terminal"), [R, a] = v((t == null ? void 0 : t.agent_slug) || ""), [u, b] = v((t == null ? void 0 : t.reuse_session) ?? !1), [x, w] = v((t == null ? void 0 : t.command) || ""), [S, k] = v((t == null ? void 0 : t.notify_exit_codes) || ""), [Y, K] = v([]);
    N(() => {
      e.sdk.api.fetch(e.app.apiUrl("/agents")).then((i) => i.json()).then((i) => K(i.ap_agents || [])).catch(() => K([]));
    }, []);
    const ue = {
      terminal: "Terminal",
      agent_prompt: "Agent Prompt",
      agentic_output: "Agentic Output"
    }, pe = async () => {
      if (y(null), !d.trim()) {
        y("Name is required.");
        return;
      }
      if (T === "agent_prompt" && !R) {
        y("Pick an agent.");
        return;
      }
      if (T === "agentic_output") {
        if (!x.trim()) {
          y("Command is required.");
          return;
        }
        if (!R) {
          y("Pick an agent.");
          return;
        }
      }
      $(!0);
      try {
        const i = s ? e.app.apiUrl("/tasks") : e.app.apiUrl(`/tasks/${encodeURIComponent(t.id)}`), xe = s ? "POST" : "PUT", V = await e.sdk.api.fetch(i, {
          method: xe,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: d.trim(),
            type: T,
            cli_type: "terminal",
            prompt: C,
            schedules: l,
            enabled: h,
            agent_slug: R,
            reuse_session: u,
            command: x,
            notify_exit_codes: S
          })
        }), U = await V.json();
        if (!V.ok) {
          y((U == null ? void 0 : U.error) || "Save failed");
          return;
        }
        n(U);
      } catch (i) {
        y(String(i));
      } finally {
        $(!1);
      }
    };
    return /* @__PURE__ */ e.h("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" }, /* @__PURE__ */ e.h("div", { className: "bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]" }, /* @__PURE__ */ e.h("h2", { className: "text-sm font-semibold text-[var(--color-text-primary)]" }, s ? "New task" : `Edit task — ${t.name}`), /* @__PURE__ */ e.h("button", { onClick: r, className: "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg" }, "×")), /* @__PURE__ */ e.h("div", { className: "p-4 space-y-4" }, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Name"), /* @__PURE__ */ e.h(
      "input",
      {
        autoFocus: !0,
        value: d,
        onChange: (i) => p(i.target.value),
        placeholder: "e.g. Daily standup digest",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "The bound terminal session will be named ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, '"Task: ', d || "<name>", '"'), ".")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Type"), /* @__PURE__ */ e.h("div", { className: "flex rounded border border-[var(--color-border)] overflow-hidden w-fit" }, ["terminal", "agent_prompt", "agentic_output"].map((i) => /* @__PURE__ */ e.h(
      "button",
      {
        key: i,
        type: "button",
        onClick: () => P(i),
        className: `px-3 py-1.5 text-xs border-r border-[var(--color-border)] last:border-r-0 ${T === i ? "bg-[var(--color-accent)] text-white font-semibold" : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"}`
      },
      ue[i]
    ))), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, T === "terminal" && "Runs a CLI/command in a reusable terminal session.", T === "agent_prompt" && "Calls an Agents Platform agent with the prompt.", T === "agentic_output" && "Runs a command; on a notable exit code, a Telegram bot’s agent interprets and reports the output.")), T === "terminal" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Command"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: C,
        onChange: (i) => c(i.target.value),
        rows: 3,
        placeholder: "Shell command typed into the bash session, e.g. ./aw status",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Runs in a plain bash terminal session. Lines are executed followed by Enter — supports pipes, multiple commands separated by ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, ";"), " or ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "&&"), "."))), T === "agent_prompt" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Agent ", /* @__PURE__ */ e.h("span", { className: "normal-case text-[var(--color-text-muted)]" }, "(Agents Platform)")), /* @__PURE__ */ e.h(
      "select",
      {
        value: R,
        onChange: (i) => a(i.target.value),
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ e.h("option", { value: "" }, "— pick an agent —"),
      Y.map((i) => /* @__PURE__ */ e.h("option", { key: i.slug, value: i.slug }, i.name || i.slug))
    )), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Prompt"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: C,
        onChange: (i) => c(i.target.value),
        rows: 6,
        placeholder: "The prompt sent to the agent when this task runs.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    )), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(I, { checked: u, onChange: b, label: "Reuse session", tone: "ok" }), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Reuse session"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "First run creates the agent session; later runs resume it to keep context.")))), T === "agentic_output" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Command"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: x,
        onChange: (i) => w(i.target.value),
        rows: 3,
        placeholder: "Cheap shell command to run first, e.g. a diff/check script — no LLM cost.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Runs on every fire. The agent below is only invoked when the exit code is notable — this is what keeps the type cheap.")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Notify on exit code"), /* @__PURE__ */ e.h(
      "input",
      {
        value: S,
        onChange: (i) => k(i.target.value),
        placeholder: "blank = any non-zero · or a list like 1,2,127",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, `Which exit codes count as "there's a difference" and trigger the agent below. Leave blank for any non-zero.`)), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Agent ", /* @__PURE__ */ e.h("span", { className: "normal-case text-[var(--color-text-muted)]" }, "(Agents Platform)")), /* @__PURE__ */ e.h(
      "select",
      {
        value: R,
        onChange: (i) => a(i.target.value),
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ e.h("option", { value: "" }, "— pick an agent —"),
      Y.map((i) => /* @__PURE__ */ e.h("option", { key: i.slug, value: i.slug }, i.name || i.slug))
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Only invoked on a notable exit code — with your prompt below plus the command's captured output appended.")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Prompt"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: C,
        onChange: (i) => c(i.target.value),
        rows: 6,
        placeholder: "Instructions for the agent — what to do with the command's output when there's a difference.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    )), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(I, { checked: u, onChange: b, label: "Reuse session", tone: "ok" }), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Reuse session"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "First triggered run creates the agent session; later runs resume it to keep context.")))), /* @__PURE__ */ e.h(le, { schedules: l, onChange: m }), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(
      I,
      {
        checked: h,
        onChange: g,
        label: "Enabled",
        tone: "ok"
      }
    ), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Enabled"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "When off, scheduled fires are skipped. Manual ▶ Run-now still works."))), f && /* @__PURE__ */ e.h("div", { className: "px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, f)), /* @__PURE__ */ e.h("div", { className: "flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h(
      "button",
      {
        onClick: r,
        className: "px-3 py-1.5 text-xs rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      },
      "Cancel"
    ), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: pe,
        disabled: o,
        className: "px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 disabled:opacity-50"
      },
      o ? "Saving…" : s ? "Create task" : "Save changes"
    ))));
  }
  function ce({ presentation: t, hideTaskTags: r, onClick: n }) {
    const s = A(null), d = A(null), [p, C] = v(0.18), c = 1e3, l = 650, m = l / c;
    N(() => {
      const g = d.current;
      if (!g || typeof ResizeObserver > "u") return;
      const f = new ResizeObserver((y) => {
        for (const o of y) {
          const $ = o.contentRect.width;
          $ > 0 && C($ / c);
        }
      });
      return f.observe(g), () => f.disconnect();
    }, []), N(() => {
      const g = s.current;
      if (!(!g || !(t != null && t.html)))
        try {
          const f = g.contentDocument;
          f.open();
          const y = "<style>html,body{margin:0;padding:0;overflow:hidden;}*{max-width:100%;box-sizing:border-box;}</style>";
          let o = t.html;
          o = o.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""), o = o.replace(/\s+on\w+="[^"]*"/gi, ""), o = o.replace(/\s+on\w+='[^']*'/gi, ""), o.includes("<head>") ? o = o.replace("<head>", "<head>" + y) : o.includes("<html>") ? o = o.replace("<html>", "<html><head>" + y + "</head>") : o = y + o, f.write(o), f.close();
        } catch {
        }
    }, [t == null ? void 0 : t.html]);
    const h = (t.tags || []).filter((g) => !r || !r.has(g));
    return /* @__PURE__ */ e.h(
      "div",
      {
        onClick: n,
        className: "group rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden cursor-pointer hover:border-[var(--color-accent)] transition-colors",
        title: t.title || t.id
      },
      /* @__PURE__ */ e.h(
        "div",
        {
          ref: d,
          className: "relative bg-[var(--color-bg-primary)]",
          style: { width: "100%", paddingTop: `${m * 100}%`, overflow: "hidden" }
        },
        /* @__PURE__ */ e.h(
          "iframe",
          {
            ref: s,
            sandbox: "allow-same-origin",
            tabIndex: -1,
            "aria-hidden": !0,
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: c,
              height: l,
              border: 0,
              pointerEvents: "none",
              transform: `scale(${p})`,
              transformOrigin: "top left"
            }
          }
        )
      ),
      /* @__PURE__ */ e.h("div", { className: "px-2 py-1.5 border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h("div", { className: "text-[11px] font-medium text-[var(--color-text-primary)] truncate" }, t.title || "Untitled"), h.length > 0 && /* @__PURE__ */ e.h("div", { className: "flex flex-wrap gap-0.5 mt-0.5 overflow-hidden", style: { maxHeight: 16 } }, h.slice(0, 3).map((g) => /* @__PURE__ */ e.h(
        "span",
        {
          key: g,
          className: "text-[8px] font-mono leading-none px-1 py-[2px] rounded bg-white/5 border border-white/10 text-[var(--color-text-muted)] truncate",
          title: g
        },
        g
      )), h.length > 3 && /* @__PURE__ */ e.h("span", { className: "text-[8px] leading-none px-1 py-[2px] text-[var(--color-text-muted)]", title: h.slice(3).join(", ") }, "+", h.length - 3)), /* @__PURE__ */ e.h("div", { className: "text-[9px] text-[var(--color-text-muted)] truncate mt-0.5" }, L(t.created_at)))
    );
  }
  function ie({ task: t, presentations: r }) {
    const n = (d) => {
      var p;
      (p = window.__awOpenPresentation) == null || p.call(window, d);
    };
    if (!r || r.length === 0)
      return /* @__PURE__ */ e.h("div", { className: "px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic border-t border-[var(--color-border)]" }, "No generated assets yet. Presentations produced inside this task's bound session are tagged ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "task:", t.id), " automatically.");
    const s = /* @__PURE__ */ new Set([`task:${t.id}`]);
    return t.name && t.name !== t.id && s.add(`task:${t.name}`), /* @__PURE__ */ e.h("div", { className: "border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h("div", { className: "px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)]/40" }, "Generated assets (", r.length, ")"), /* @__PURE__ */ e.h("div", { className: "flex gap-2 p-3 overflow-x-auto overflow-y-hidden" }, r.map((d) => /* @__PURE__ */ e.h("div", { key: d.id, className: "shrink-0", style: { width: 200 } }, /* @__PURE__ */ e.h(ce, { presentation: d, hideTaskTags: s, onClick: () => n(d.id) })))));
  }
  function de({ task: t, onOpen: r }) {
    const n = t.runs || [];
    return n.length ? /* @__PURE__ */ e.h("div", { className: "border-t border-[var(--color-border)]" }, n.map((s) => /* @__PURE__ */ e.h(
      "div",
      {
        key: s.id,
        onClick: () => r(s),
        style: ae,
        className: "items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-white/[0.03] cursor-pointer",
        title: s.session_id ? "Click to open the terminal this run used" : "This run never reached a terminal session"
      },
      /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-text-muted)]" }, L(s.started_at)),
      /* @__PURE__ */ e.h("span", { className: "text-[var(--color-text-muted)]" }, s.trigger),
      /* @__PURE__ */ e.h(z, { status: s.status }),
      /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-text-muted)] truncate" }, s.error || "")
    ))) : /* @__PURE__ */ e.h("div", { className: "px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic" }, "No runs yet.");
  }
  function me() {
    const [t, r] = v(null), [n, s] = v(null), [d, p] = v({}), [C, c] = v(null), l = _(async () => {
      try {
        const u = await (await e.sdk.api.fetch(e.app.apiUrl("/tasks"))).json();
        r(u.tasks || []);
      } catch (a) {
        c(String(a)), r((u) => u ?? []);
      }
    }, []);
    N(() => {
      l();
    }, [l]), B(l);
    const m = Q(), [h, g] = v({}), f = _(async () => {
      try {
        const u = await (await e.sdk.api.fetch("/api/apps/presentations/presentations")).json(), b = {}, x = {};
        for (const w of Array.isArray(u) ? u : []) {
          const S = /* @__PURE__ */ new Set();
          for (const k of w.tags || [])
            typeof k == "string" && k.startsWith("task:") && S.add(k.slice(5));
          for (const k of S)
            x[k] || (x[k] = /* @__PURE__ */ new Set()), !x[k].has(w.id) && (x[k].add(w.id), (b[k] = b[k] || []).push(w));
        }
        for (const w of Object.keys(b))
          b[w].sort((S, k) => (k.created_at || 0) - (S.created_at || 0));
        g(b);
      } catch {
      }
    }, []), y = _((a) => {
      const u = h[a.id] || [], b = a.name && a.name !== a.id ? h[a.name] || [] : [];
      if (!b.length) return u;
      if (!u.length) return b;
      const x = new Set(u.map((S) => S.id)), w = [...u];
      for (const S of b)
        x.has(S.id) || w.push(S);
      return w.sort((S, k) => (k.created_at || 0) - (S.created_at || 0)), w;
    }, [h]);
    N(() => {
      f();
    }, [f]), N(() => {
      const a = () => f();
      return window.addEventListener("aw-presentation-update", a), () => window.removeEventListener("aw-presentation-update", a);
    }, [f]);
    const o = A({});
    N(() => {
      const a = (u) => {
        var x;
        const b = (x = u.detail) == null ? void 0 : x.taskId;
        b && (p((w) => ({ ...w, [b]: !0 })), setTimeout(() => {
          const w = o.current[b];
          w && w.scrollIntoView && w.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60));
      };
      return window.addEventListener("aw-focus-task", a), () => window.removeEventListener("aw-focus-task", a);
    }, []);
    const $ = async (a) => {
      try {
        await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(a)}/run`), { method: "POST" }), l();
      } catch (u) {
        c(String(u));
      }
    }, T = async (a) => {
      if (confirm("Delete this task and its bound terminal session?"))
        try {
          await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(a)}`), { method: "DELETE" }), l();
        } catch (u) {
          c(String(u));
        }
    }, P = async (a) => {
      try {
        await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(a.id)}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !a.enabled })
        }), l();
      } catch (u) {
        c(String(u));
      }
    }, R = async (a, u) => {
      const b = (u == null ? void 0 : u.session_id) || (a == null ? void 0 : a.session_id);
      if (!b) {
        c(u ? "That run never reached a terminal session — see its error." : "This task has no terminal session yet — run it once first.");
        return;
      }
      if (typeof window.__awOpenTerminal != "function") {
        c("This workspace shell cannot open terminal windows.");
        return;
      }
      window.__awOpenTerminal(b);
    };
    return /* @__PURE__ */ e.h("div", { className: "p-4 w-full" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("h1", { className: "text-sm font-semibold text-[var(--color-text-primary)]" }, "Scheduled Tasks"), /* @__PURE__ */ e.h("p", { className: "text-[11px] text-[var(--color-text-muted)] mt-0.5" }, 'Each task fires its prompt into a single reusable CLI session named "Task: ', "<name>", '".')), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => s("new"),
        className: "px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25"
      },
      "+ New task"
    )), C && /* @__PURE__ */ e.h("div", { className: "mb-3 px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, C), m && /* @__PURE__ */ e.h("div", { className: "mb-3 px-2 py-1.5 text-[11px] rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30" }, m, " Reload the page to resume."), t === null ? /* @__PURE__ */ e.h("div", { className: "px-3 py-12 text-center text-xs text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-border)] rounded" }, "Loading tasks…") : t.length === 0 ? /* @__PURE__ */ e.h("div", { className: "px-3 py-12 text-center text-xs text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-border)] rounded" }, 'No tasks yet. Click "+ New task" to create one.') : /* @__PURE__ */ e.h("div", { className: "border border-[var(--color-border)] rounded overflow-hidden" }, /* @__PURE__ */ e.h("div", { style: F, className: "items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)] border-b border-[var(--color-border)]" }, /* @__PURE__ */ e.h("span", null, "Name"), /* @__PURE__ */ e.h("span", null, "CLI"), /* @__PURE__ */ e.h("span", null, "Schedule"), /* @__PURE__ */ e.h("span", null, "On"), /* @__PURE__ */ e.h("span", null, "Last run"), /* @__PURE__ */ e.h("span", null, "Presentation"), /* @__PURE__ */ e.h("span", { className: "text-right" }, "Actions")), t.map((a) => {
      const u = !!d[a.id], b = ne(a.schedules);
      return /* @__PURE__ */ e.h(
        "div",
        {
          key: a.id,
          ref: (x) => {
            x ? o.current[a.id] = x : delete o.current[a.id];
          },
          className: "border-b border-[var(--color-border)] last:border-b-0"
        },
        /* @__PURE__ */ e.h("div", { style: F, className: "items-center gap-2 px-3 py-2 hover:bg-white/[0.02]" }, /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => p((x) => ({ ...x, [a.id]: !u })),
            className: "flex items-center gap-1.5 text-left min-w-0"
          },
          /* @__PURE__ */ e.h("span", { className: "text-[var(--color-text-muted)] text-[10px] w-2.5" }, u ? "▼" : "▶"),
          /* @__PURE__ */ e.h("span", { className: "text-xs text-[var(--color-text-primary)] truncate" }, a.name),
          a.agent_session_id && /* @__PURE__ */ e.h(
            "span",
            {
              className: "text-[9px] font-mono text-[var(--color-text-muted)] shrink-0",
              title: `Agent conversation: ${a.agent_session_id}`
            },
            a.agent_session_id.length > 12 ? a.agent_session_id.slice(0, 8) : a.agent_session_id
          )
        ), /* @__PURE__ */ e.h("span", { className: "text-[11px] font-mono text-[var(--color-text-muted)] truncate flex items-center gap-1" }, a.type === "agent_prompt" || a.type === "agentic_output" ? `agent:${a.agent_slug || "?"}` : a.cli_type), /* @__PURE__ */ e.h(
          "span",
          {
            className: "text-[11px] text-[var(--color-text-muted)] truncate",
            title: (a.schedules || []).map(H).join(`
`) || "—"
          },
          b
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => P(a),
            className: `text-[10px] px-1.5 py-0.5 rounded ${a.enabled ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10"}`,
            title: a.enabled ? "Disable" : "Enable"
          },
          a.enabled ? "on" : "off"
        ), /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5" }, /* @__PURE__ */ e.h(z, { status: a.last_run_status }), /* @__PURE__ */ e.h("span", { title: L(a.last_run_at) }, re(a.last_run_at))), (() => {
          const x = y(a).length;
          return /* @__PURE__ */ e.h(
            "button",
            {
              onClick: () => p((w) => ({ ...w, [a.id]: !u })),
              title: x > 0 ? `${x} presentation${x === 1 ? "" : "es"} — click to expand` : "No presentations for this task",
              disabled: x === 0,
              className: `flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${x > 0 ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 cursor-pointer" : "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"}`
            },
            /* @__PURE__ */ e.h("svg", { className: "w-3 h-3", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), /* @__PURE__ */ e.h("path", { d: "M3 9h18M9 3v18" })),
            /* @__PURE__ */ e.h("span", { className: "font-mono" }, x)
          );
        })(), /* @__PURE__ */ e.h("span", { className: "flex items-center justify-end gap-1" }, /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => $(a.id),
            title: "Run now",
            className: "p-1 rounded hover:bg-white/10 text-green-400"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ e.h("path", { d: "M8 5v14l11-7z" }))
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => R(a),
            title: a.session_id ? "Open the terminal this task ran in" : "No terminal session yet — run the task once",
            disabled: !a.session_id,
            className: "p-1 rounded hover:bg-white/10 text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("polyline", { points: "4 17 10 11 4 5" }), /* @__PURE__ */ e.h("line", { x1: "12", y1: "19", x2: "20", y2: "19" }))
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => s(a),
            title: "Edit",
            className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), /* @__PURE__ */ e.h("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" }))
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => T(a.id),
            title: "Delete",
            className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ e.h("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }), /* @__PURE__ */ e.h("path", { d: "M10 11v6M14 11v6" }), /* @__PURE__ */ e.h("path", { d: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" }))
        ))),
        u && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h(de, { task: a, onOpen: (x) => R(a, x) }), /* @__PURE__ */ e.h(ie, { task: a, presentations: y(a) }))
      );
    })), n && /* @__PURE__ */ e.h(
      se,
      {
        task: n === "new" ? null : n,
        onClose: () => s(null),
        onSaved: () => {
          s(null), l();
        }
      }
    ));
  }
  e.registerSlot("core.nav.workspace", te), e.registerWindow("tasks.main", me);
}
export {
  ge as default,
  ge as register
};
