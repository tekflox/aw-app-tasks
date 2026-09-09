function pe({ apiUrl: e, fetchImpl: L = fetch }) {
  async function p() {
    const y = await L(e("/tasks"));
    if (!y.ok) throw new Error(`GET /tasks -> ${y.status}`);
    return (await y.json()).tasks || [];
  }
  async function E(y) {
    const b = await L(e(`/tasks/${encodeURIComponent(y)}/run`), { method: "POST" }), T = await b.json().catch(() => ({}));
    if (!b.ok) throw new Error(T.detail || T.error || `POST /tasks/${y}/run -> ${b.status}`);
    return T;
  }
  return { listTasks: p, runTask: E };
}
const xe = /* @__PURE__ */ new Set([4401, 4403, 4426]), ve = 500, ge = 3e4, fe = 1;
function be(e) {
  const L = Math.min(ge, ve * 2 ** e);
  return L / 2 + Math.random() * (L / 2);
}
function he({ url: e, onFrame: L, onStatus: p = () => {
} }) {
  let E = null, y = null, b = 0, T = 0, P = null;
  function U(h, f, A) {
    try {
      p({ state: h, code: f, message: A });
    } catch {
    }
  }
  function F() {
    T === 0 || P || y || (y = setTimeout(() => {
      y = null, b += 1, z();
    }, be(b)));
  }
  function Y(h) {
    let f;
    try {
      f = JSON.parse(h);
    } catch {
      return;
    }
    if (!f || typeof f != "object" || typeof f.type != "string") return;
    const A = f.data && typeof f.data == "object" ? f.data : {};
    if (f.type === "error") {
      console.warn(`[tasks] ws error: ${A.code || "unknown"} — ${A.message || ""}`);
      return;
    }
    if (f.type === "tasks_init") {
      const W = Number(A.protocol);
      if (Number.isFinite(W) && W > fe) {
        P = 4426, U(
          "fatal",
          4426,
          `Tasks updates need a newer page — reload (server protocol ${W}).`
        );
        try {
          E.close(4426, "protocol not supported");
        } catch {
        }
        return;
      }
      U("open", null, null);
      return;
    }
    L(f);
  }
  function z() {
    if (P || T === 0) return;
    let h;
    try {
      h = new WebSocket(e());
    } catch {
      F();
      return;
    }
    E = h, h.onopen = () => {
      b = 0;
    }, h.onmessage = (f) => Y(f.data), h.onerror = () => {
      try {
        h.close();
      } catch {
      }
    }, h.onclose = (f) => {
      if (E === h && (E = null), !P) {
        if (xe.has(f.code)) {
          P = f.code;
          const A = f.code === 4403 ? "not permitted" : f.code === 4426 ? "reload required" : "session expired";
          console.warn(`[tasks] live updates stopped (${f.code} — ${A}); not reconnecting.`), U("fatal", f.code, `Live task updates stopped — ${A}.`);
          return;
        }
        U("closed", f.code, null), F();
      }
    };
  }
  function G() {
    if (clearTimeout(y), y = null, b = 0, E) {
      const h = E;
      E = null, h.onclose = null, h.onerror = null, h.onmessage = null;
      try {
        h.close();
      } catch {
      }
    }
  }
  return {
    retain() {
      T += 1, T === 1 && z();
      let h = !1;
      return () => {
        h || (h = !0, T -= 1, T === 0 && G());
      };
    }
  };
}
function ye(e) {
  const L = pe({
    apiUrl: e.app.apiUrl,
    fetchImpl: e.sdk.api.fetch
  }), { useState: p, useRef: E, useCallback: y, useEffect: b } = e.React;
  let T = null;
  const P = /* @__PURE__ */ new Set(), U = he({
    url: () => e.app.wsUrl("/ws/updates"),
    onFrame: (t) => {
      t.type === "tasks_update" && window.dispatchEvent(new CustomEvent("aw-task-update", { detail: t.data }));
    },
    onStatus: ({ state: t, message: a }) => {
      if (t === "fatal") T = a;
      else if (t === "open") T = null;
      else return;
      for (const n of P) n(T);
    }
  });
  function F(t) {
    b(() => U.retain(), []), b(() => {
      const a = () => t();
      return window.addEventListener("aw-task-update", a), () => window.removeEventListener("aw-task-update", a);
    }, [t]);
  }
  function Y() {
    const [t, a] = p(T);
    return b(() => (P.add(a), a(T), () => P.delete(a)), []), t;
  }
  function z() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ e.h("polyline", { points: "12 6 12 12 16 14" }));
  }
  function G() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3 h-3", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ e.h("path", { d: "M8 5v14l11-7z" }));
  }
  function h(t) {
    const a = t.schedules || [];
    if (a.length === 0) return "manual";
    if (a.length > 1) return `${a.length} schedules`;
    const n = a[0];
    return n.kind === "cron" ? n.expr || "cron" : n.kind || "scheduled";
  }
  function f() {
    const [t, a] = p(!1), [n, s] = p([]), [d, x] = p(null), [$, c] = p(null), l = E(null), u = y(async () => {
      try {
        s(await L.listTasks()), x(null);
      } catch (o) {
        x(String(o.message || o));
      }
    }, []);
    b(() => {
      u();
    }, [u]), F(u), b(() => () => clearTimeout(l.current), []);
    const N = y(() => {
      clearTimeout(l.current), a(!0), u();
    }, [u]), g = y(() => {
      l.current = setTimeout(() => a(!1), 150);
    }, []), k = y(() => {
      var o;
      a(!1), (o = window.__awOpenAppWindow) == null || o.call(window, "tasks.main");
    }, []), _ = y(async (o) => {
      c(o.id), x(null);
      try {
        await L.runTask(o.id), await u();
      } catch (M) {
        x(`${o.name}: ${M.message || M}`);
      } finally {
        c(null);
      }
    }, [u]);
    return /* @__PURE__ */ e.h("div", { className: "relative", onMouseEnter: N, onMouseLeave: g }, /* @__PURE__ */ e.h(
      "div",
      {
        onClick: k,
        className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer"
      },
      /* @__PURE__ */ e.h(z, null),
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
          onClick: k,
          className: "text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors",
          title: "Open Tasks window"
        },
        "Open all →"
      )),
      d && /* @__PURE__ */ e.h("div", { className: "mx-1 mb-2 px-2 py-1 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, d),
      n.length === 0 ? /* @__PURE__ */ e.h("div", { className: "px-3 py-6 text-center text-xs text-[var(--color-text-muted)] italic" }, 'No tasks yet. Click "Open all →" to create one.') : /* @__PURE__ */ e.h("div", { className: "overflow-y-auto", style: { maxHeight: "70vh" } }, n.map((o) => {
        const M = $ === o.id, R = o.last_run_status === "ok" ? "bg-green-400" : o.last_run_status === "error" ? "bg-red-400" : o.last_run_status === "running" ? "bg-blue-400" : "bg-white/20";
        return /* @__PURE__ */ e.h(
          "div",
          {
            key: o.id,
            className: "group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.05]",
            title: o.name
          },
          /* @__PURE__ */ e.h("span", { className: `w-1.5 h-1.5 rounded-full shrink-0 ${R}` }),
          /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ e.h("span", { className: "text-[13px] text-[var(--color-text-primary)] truncate" }, o.name), !o.enabled && /* @__PURE__ */ e.h("span", { className: "px-1 py-0.5 rounded text-[9px] bg-white/5 text-[var(--color-text-muted)] shrink-0" }, "off")), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] truncate font-mono" }, o.type === "agent_prompt" || o.type === "agentic_output" ? o.type : o.cli_type, " · ", h(o))),
          /* @__PURE__ */ e.h(
            "button",
            {
              onClick: (B) => {
                B.stopPropagation(), _(o);
              },
              disabled: M,
              className: "p-1 rounded hover:bg-white/10 text-green-400 disabled:opacity-50 shrink-0",
              title: "Run now"
            },
            M ? /* @__PURE__ */ e.h("svg", { className: "w-3 h-3 animate-spin", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10", opacity: "0.25" }), /* @__PURE__ */ e.h("path", { d: "M4 12a8 8 0 0 1 8-8" })) : /* @__PURE__ */ e.h(G, null)
          )
        );
      }))
    ));
  }
  const A = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], W = { display: "grid", gridTemplateColumns: "minmax(160px,1fr) 90px minmax(160px,1fr) 60px 120px 70px 140px" }, ee = { display: "grid", gridTemplateColumns: "160px 70px 60px 1fr" };
  function I(t) {
    return t ? new Date(t * 1e3).toLocaleString() : "—";
  }
  function te(t) {
    if (!t) return "—";
    const a = Date.now() / 1e3 - t;
    return a < 60 ? `${Math.floor(a)}s ago` : a < 3600 ? `${Math.floor(a / 60)}m ago` : a < 86400 ? `${Math.floor(a / 3600)}h ago` : `${Math.floor(a / 86400)}d ago`;
  }
  function q({ status: t }) {
    const a = t === "ok" ? "bg-green-500/15 text-green-400" : t === "error" ? "bg-red-500/15 text-red-400" : t === "running" ? "bg-blue-500/15 text-blue-400" : "bg-white/5 text-[var(--color-text-muted)]";
    return /* @__PURE__ */ e.h("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-mono ${a}` }, t || "—");
  }
  function K(t) {
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
        return `Weekly ${(t.days || []).map((n) => A[n] || n).join("/")} ${t.time}`;
      case "monthly":
        return `Monthly day ${t.day_of_month} at ${t.time}`;
      case "cron":
        return `Cron · ${t.expr}`;
      default:
        return JSON.stringify(t);
    }
  }
  function re(t) {
    return !t || !t.length ? "—" : t.length === 1 ? K(t[0]) : `${t.length} schedules`;
  }
  function V(t) {
    const a = /* @__PURE__ */ new Date(), n = (d) => String(d).padStart(2, "0"), s = `${n(a.getHours())}:${n(Math.min(59, a.getMinutes()))}`;
    switch (t) {
      case "once": {
        const d = new Date(a.getTime() + 36e5);
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
  function D(t) {
    return `bg-[var(--color-bg-primary)] border rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] ${t ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`;
  }
  function ae({ value: t, error: a, onChange: n, onRemove: s, nextFireAt: d }) {
    const x = t.kind, $ = (l) => n(V(l)), c = (l) => n({ ...t, ...l });
    return /* @__PURE__ */ e.h("div", { className: "border border-[var(--color-border)] rounded p-2 bg-[var(--color-bg-primary)]/40" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2 mb-2" }, /* @__PURE__ */ e.h(
      "select",
      {
        value: x,
        onChange: (l) => $(l.target.value),
        className: D(!1) + " shrink-0"
      },
      /* @__PURE__ */ e.h("option", { value: "once" }, "Once"),
      /* @__PURE__ */ e.h("option", { value: "daily" }, "Daily"),
      /* @__PURE__ */ e.h("option", { value: "weekly" }, "Weekly"),
      /* @__PURE__ */ e.h("option", { value: "monthly" }, "Monthly"),
      /* @__PURE__ */ e.h("option", { value: "cron" }, "Cron (advanced)")
    ), /* @__PURE__ */ e.h("span", { className: "flex-1" }), d && !a && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)] truncate" }, "Next: ", /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-accent)]" }, I(d))), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: s,
        title: "Remove schedule",
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] shrink-0"
      },
      /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ e.h("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }))
    )), x === "once" && /* @__PURE__ */ e.h(
      "input",
      {
        type: "datetime-local",
        value: t.at || "",
        onChange: (l) => c({ at: l.target.value }),
        className: D(!!a) + " w-full"
      }
    ), x === "daily" && /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] w-12" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (l) => c({ time: l.target.value }),
        className: D(!!a)
      }
    )), x === "weekly" && /* @__PURE__ */ e.h("div", { className: "space-y-2" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1 flex-wrap" }, A.map((l, u) => {
      const N = (t.days || []).includes(u);
      return /* @__PURE__ */ e.h(
        "button",
        {
          key: u,
          type: "button",
          onClick: () => {
            const g = new Set(t.days || []);
            N ? g.delete(u) : g.add(u), c({ days: [...g].sort((k, _) => k - _) });
          },
          className: `px-2 py-1 text-[11px] rounded border ${N ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30" : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-white/5"}`
        },
        l
      );
    })), /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] w-12" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (l) => c({ time: l.target.value }),
        className: D(!!a)
      }
    ))), x === "monthly" && /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "on day"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "number",
        min: 1,
        max: 31,
        value: t.day_of_month ?? 1,
        onChange: (l) => c({ day_of_month: Number(l.target.value) }),
        className: D(!!a) + " w-16"
      }
    ), /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (l) => c({ time: l.target.value }),
        className: D(!!a)
      }
    )), x === "cron" && /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h(
      "input",
      {
        type: "text",
        value: t.expr || "",
        placeholder: "0 9 * * *",
        onChange: (l) => c({ expr: l.target.value }),
        className: D(!!a) + " w-full font-mono"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "5 fields: minute hour day-of-month month day-of-week. Examples:", /* @__PURE__ */ e.h("span", { className: "font-mono" }, " */15 * * * *"), ",", " ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "0 9 * * 1-5"), ",", " ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "@hourly"), ".")), a && /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-danger)] mt-1" }, a));
  }
  function ne({ schedules: t, onChange: a }) {
    const [n, s] = p(null);
    b(() => {
      if (!t.length) {
        s(null);
        return;
      }
      const c = setTimeout(async () => {
        try {
          const u = await (await e.sdk.api.fetch(e.app.apiUrl("/preview-schedules"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ schedules: t })
          })).json();
          s(u);
        } catch {
          s({ ok: !1, entries: [], error: "Network error" });
        }
      }, 300);
      return () => clearTimeout(c);
    }, [t]);
    const d = (c, l) => {
      const u = t.slice();
      u[c] = l, a(u);
    }, x = (c) => a(t.filter((l, u) => u !== c)), $ = (c) => a([...t, V(c)]);
    return /* @__PURE__ */ e.h("div", { className: "space-y-2" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" }, "Schedules"), /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)]" }, n != null && n.next_fire_at ? /* @__PURE__ */ e.h(e.React.Fragment, null, "Next fires: ", /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-accent)]" }, I(n.next_fire_at))) : t.length === 0 ? "No schedule — runs only on manual ▶" : "No upcoming fire")), t.map((c, l) => {
      var N;
      const u = (N = n == null ? void 0 : n.entries) == null ? void 0 : N.find((g) => g.index === l);
      return /* @__PURE__ */ e.h(
        ae,
        {
          key: l,
          value: c,
          error: u && !u.ok ? u.error : null,
          nextFireAt: u == null ? void 0 : u.next_fire_at,
          onChange: (g) => d(l, g),
          onRemove: () => x(l)
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
        onClick: () => $(c),
        className: "px-2 py-1 text-[11px] rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
      },
      "+ ",
      l
    ))));
  }
  function J({ checked: t, onChange: a, disabled: n, label: s, tone: d = "danger" }) {
    const x = d === "ok" ? "bg-green-500" : "bg-[var(--color-danger)]";
    return /* @__PURE__ */ e.h(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": t,
        disabled: n,
        onClick: () => !n && a(!t),
        title: s,
        className: `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${n ? "bg-white/5 cursor-not-allowed" : t ? x : "bg-white/10 hover:bg-white/15"}`
      },
      /* @__PURE__ */ e.h(
        "span",
        {
          className: `inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${t ? "translate-x-[18px]" : "translate-x-0.5"}`
        }
      )
    );
  }
  function oe({ task: t, onClose: a, onSaved: n }) {
    const s = !t, [d, x] = p((t == null ? void 0 : t.name) || ""), [$, c] = p((t == null ? void 0 : t.prompt) || ""), [l, u] = p((t == null ? void 0 : t.schedules) || []), [N, g] = p((t == null ? void 0 : t.enabled) ?? !0), [k, _] = p(null), [o, M] = p(!1), [R, B] = p((t == null ? void 0 : t.type) || "terminal"), [j, r] = p((t == null ? void 0 : t.agent_slug) || ""), [m, w] = p((t == null ? void 0 : t.reuse_session) ?? !1), [v, C] = p((t == null ? void 0 : t.command) || ""), [O, S] = p((t == null ? void 0 : t.notify_exit_codes) || ""), [X, Q] = p([]);
    b(() => {
      e.sdk.api.fetch(e.app.apiUrl("/agents")).then((i) => i.json()).then((i) => Q(i.ap_agents || [])).catch(() => Q([]));
    }, []);
    const de = {
      terminal: "Terminal",
      agent_prompt: "Agent Prompt",
      agentic_output: "Agentic Output"
    }, ue = async () => {
      if (_(null), !d.trim()) {
        _("Name is required.");
        return;
      }
      if (R === "agent_prompt" && !j) {
        _("Pick an agent.");
        return;
      }
      if (R === "agentic_output") {
        if (!v.trim()) {
          _("Command is required.");
          return;
        }
        if (!j) {
          _("Pick an agent.");
          return;
        }
      }
      M(!0);
      try {
        const i = s ? e.app.apiUrl("/tasks") : e.app.apiUrl(`/tasks/${encodeURIComponent(t.id)}`), me = s ? "POST" : "PUT", Z = await e.sdk.api.fetch(i, {
          method: me,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: d.trim(),
            type: R,
            cli_type: "terminal",
            prompt: $,
            schedules: l,
            enabled: N,
            agent_slug: j,
            reuse_session: m,
            command: v,
            notify_exit_codes: O
          })
        }), H = await Z.json();
        if (!Z.ok) {
          _((H == null ? void 0 : H.error) || "Save failed");
          return;
        }
        n(H);
      } catch (i) {
        _(String(i));
      } finally {
        M(!1);
      }
    };
    return /* @__PURE__ */ e.h("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" }, /* @__PURE__ */ e.h("div", { className: "bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]" }, /* @__PURE__ */ e.h("h2", { className: "text-sm font-semibold text-[var(--color-text-primary)]" }, s ? "New task" : `Edit task — ${t.name}`), /* @__PURE__ */ e.h("button", { onClick: a, className: "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg" }, "×")), /* @__PURE__ */ e.h("div", { className: "p-4 space-y-4" }, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Name"), /* @__PURE__ */ e.h(
      "input",
      {
        autoFocus: !0,
        value: d,
        onChange: (i) => x(i.target.value),
        placeholder: "e.g. Daily standup digest",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "The bound terminal session will be named ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, '"Task: ', d || "<name>", '"'), ".")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Type"), /* @__PURE__ */ e.h("div", { className: "flex rounded border border-[var(--color-border)] overflow-hidden w-fit" }, ["terminal", "agent_prompt", "agentic_output"].map((i) => /* @__PURE__ */ e.h(
      "button",
      {
        key: i,
        type: "button",
        onClick: () => B(i),
        className: `px-3 py-1.5 text-xs border-r border-[var(--color-border)] last:border-r-0 ${R === i ? "bg-[var(--color-accent)] text-white font-semibold" : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"}`
      },
      de[i]
    ))), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, R === "terminal" && "Runs a CLI/command in a reusable terminal session.", R === "agent_prompt" && "Calls an Agents Platform agent with the prompt.", R === "agentic_output" && "Runs a command; on a notable exit code, a Telegram bot’s agent interprets and reports the output.")), R === "terminal" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Command"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: $,
        onChange: (i) => c(i.target.value),
        rows: 3,
        placeholder: "Shell command typed into the bash session, e.g. ./aw status",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Runs in a plain bash terminal session. Lines are executed followed by Enter — supports pipes, multiple commands separated by ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, ";"), " or ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "&&"), "."))), R === "agent_prompt" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Agent ", /* @__PURE__ */ e.h("span", { className: "normal-case text-[var(--color-text-muted)]" }, "(Agents Platform)")), /* @__PURE__ */ e.h(
      "select",
      {
        value: j,
        onChange: (i) => r(i.target.value),
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ e.h("option", { value: "" }, "— pick an agent —"),
      X.map((i) => /* @__PURE__ */ e.h("option", { key: i.slug, value: i.slug }, i.name || i.slug))
    )), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Prompt"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: $,
        onChange: (i) => c(i.target.value),
        rows: 6,
        placeholder: "The prompt sent to the agent when this task runs.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    )), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(J, { checked: m, onChange: w, label: "Reuse session", tone: "ok" }), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Reuse session"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "First run creates the agent session; later runs resume it to keep context.")))), R === "agentic_output" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Command"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: v,
        onChange: (i) => C(i.target.value),
        rows: 3,
        placeholder: "Cheap shell command to run first, e.g. a diff/check script — no LLM cost.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Runs on every fire. The agent below is only invoked when the exit code is notable — this is what keeps the type cheap.")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Notify on exit code"), /* @__PURE__ */ e.h(
      "input",
      {
        value: O,
        onChange: (i) => S(i.target.value),
        placeholder: "blank = any non-zero · or a list like 1,2,127",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, `Which exit codes count as "there's a difference" and trigger the agent below. Leave blank for any non-zero.`)), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Agent ", /* @__PURE__ */ e.h("span", { className: "normal-case text-[var(--color-text-muted)]" }, "(Agents Platform)")), /* @__PURE__ */ e.h(
      "select",
      {
        value: j,
        onChange: (i) => r(i.target.value),
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ e.h("option", { value: "" }, "— pick an agent —"),
      X.map((i) => /* @__PURE__ */ e.h("option", { key: i.slug, value: i.slug }, i.name || i.slug))
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Only invoked on a notable exit code — with your prompt below plus the command's captured output appended.")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Prompt"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: $,
        onChange: (i) => c(i.target.value),
        rows: 6,
        placeholder: "Instructions for the agent — what to do with the command's output when there's a difference.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    )), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(J, { checked: m, onChange: w, label: "Reuse session", tone: "ok" }), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Reuse session"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "First triggered run creates the agent session; later runs resume it to keep context.")))), /* @__PURE__ */ e.h(ne, { schedules: l, onChange: u }), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(
      J,
      {
        checked: N,
        onChange: g,
        label: "Enabled",
        tone: "ok"
      }
    ), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Enabled"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "When off, scheduled fires are skipped. Manual ▶ Run-now still works."))), k && /* @__PURE__ */ e.h("div", { className: "px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, k)), /* @__PURE__ */ e.h("div", { className: "flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h(
      "button",
      {
        onClick: a,
        className: "px-3 py-1.5 text-xs rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      },
      "Cancel"
    ), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: ue,
        disabled: o,
        className: "px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 disabled:opacity-50"
      },
      o ? "Saving…" : s ? "Create task" : "Save changes"
    ))));
  }
  function le({ presentation: t, hideTaskTags: a, onClick: n }) {
    const s = E(null), d = E(null), [x, $] = p(0.18), c = 1e3, l = 650, u = l / c;
    b(() => {
      const g = d.current;
      if (!g || typeof ResizeObserver > "u") return;
      const k = new ResizeObserver((_) => {
        for (const o of _) {
          const M = o.contentRect.width;
          M > 0 && $(M / c);
        }
      });
      return k.observe(g), () => k.disconnect();
    }, []), b(() => {
      const g = s.current;
      if (!(!g || !(t != null && t.html)))
        try {
          const k = g.contentDocument;
          k.open();
          const _ = "<style>html,body{margin:0;padding:0;overflow:hidden;}*{max-width:100%;box-sizing:border-box;}</style>";
          let o = t.html;
          o = o.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""), o = o.replace(/\s+on\w+="[^"]*"/gi, ""), o = o.replace(/\s+on\w+='[^']*'/gi, ""), o.includes("<head>") ? o = o.replace("<head>", "<head>" + _) : o.includes("<html>") ? o = o.replace("<html>", "<html><head>" + _ + "</head>") : o = _ + o, k.write(o), k.close();
        } catch {
        }
    }, [t == null ? void 0 : t.html]);
    const N = (t.tags || []).filter((g) => !a || !a.has(g));
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
          style: { width: "100%", paddingTop: `${u * 100}%`, overflow: "hidden" }
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
              transform: `scale(${x})`,
              transformOrigin: "top left"
            }
          }
        )
      ),
      /* @__PURE__ */ e.h("div", { className: "px-2 py-1.5 border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h("div", { className: "text-[11px] font-medium text-[var(--color-text-primary)] truncate" }, t.title || "Untitled"), N.length > 0 && /* @__PURE__ */ e.h("div", { className: "flex flex-wrap gap-0.5 mt-0.5 overflow-hidden", style: { maxHeight: 16 } }, N.slice(0, 3).map((g) => /* @__PURE__ */ e.h(
        "span",
        {
          key: g,
          className: "text-[8px] font-mono leading-none px-1 py-[2px] rounded bg-white/5 border border-white/10 text-[var(--color-text-muted)] truncate",
          title: g
        },
        g
      )), N.length > 3 && /* @__PURE__ */ e.h("span", { className: "text-[8px] leading-none px-1 py-[2px] text-[var(--color-text-muted)]", title: N.slice(3).join(", ") }, "+", N.length - 3)), /* @__PURE__ */ e.h("div", { className: "text-[9px] text-[var(--color-text-muted)] truncate mt-0.5" }, I(t.created_at)))
    );
  }
  function se({ task: t, presentations: a }) {
    const n = (d) => {
      var x;
      (x = window.__awOpenPresentation) == null || x.call(window, d);
    };
    if (!a || a.length === 0)
      return /* @__PURE__ */ e.h("div", { className: "px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic border-t border-[var(--color-border)]" }, "No generated assets yet. Presentations produced inside this task's bound session are tagged ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "task:", t.id), " automatically.");
    const s = /* @__PURE__ */ new Set([`task:${t.id}`]);
    return t.name && t.name !== t.id && s.add(`task:${t.name}`), /* @__PURE__ */ e.h("div", { className: "border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h("div", { className: "px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)]/40" }, "Generated assets (", a.length, ")"), /* @__PURE__ */ e.h("div", { className: "flex gap-2 p-3 overflow-x-auto overflow-y-hidden" }, a.map((d) => /* @__PURE__ */ e.h("div", { key: d.id, className: "shrink-0", style: { width: 200 } }, /* @__PURE__ */ e.h(le, { presentation: d, hideTaskTags: s, onClick: () => n(d.id) })))));
  }
  function ce({ task: t, onOpen: a }) {
    const n = t.runs || [];
    return n.length ? /* @__PURE__ */ e.h("div", { className: "border-t border-[var(--color-border)]" }, n.map((s) => /* @__PURE__ */ e.h(
      "div",
      {
        key: s.id,
        onClick: () => a(s),
        style: ee,
        className: "items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-white/[0.03] cursor-pointer",
        title: s.session_id ? "Click to open the terminal this run used" : "This run never reached a terminal session"
      },
      /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-text-muted)]" }, I(s.started_at)),
      /* @__PURE__ */ e.h("span", { className: "text-[var(--color-text-muted)]" }, s.trigger),
      /* @__PURE__ */ e.h(q, { status: s.status }),
      /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-text-muted)] truncate" }, s.error || "")
    ))) : /* @__PURE__ */ e.h("div", { className: "px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic" }, "No runs yet.");
  }
  function ie() {
    const [t, a] = p([]), [n, s] = p(null), [d, x] = p({}), [$, c] = p(null), l = y(async () => {
      try {
        const m = await (await e.sdk.api.fetch(e.app.apiUrl("/tasks"))).json();
        a(m.tasks || []);
      } catch (r) {
        c(String(r));
      }
    }, []);
    b(() => {
      l();
    }, [l]), F(l);
    const u = Y(), [N, g] = p({}), k = y(async () => {
      try {
        const m = await (await e.sdk.api.fetch("/api/apps/presentations/presentations")).json(), w = {}, v = {};
        for (const C of Array.isArray(m) ? m : []) {
          const O = /* @__PURE__ */ new Set();
          for (const S of C.tags || [])
            typeof S == "string" && S.startsWith("task:") && O.add(S.slice(5));
          for (const S of O)
            v[S] || (v[S] = /* @__PURE__ */ new Set()), !v[S].has(C.id) && (v[S].add(C.id), (w[S] = w[S] || []).push(C));
        }
        for (const C of Object.keys(w))
          w[C].sort((O, S) => (S.created_at || 0) - (O.created_at || 0));
        g(w);
      } catch {
      }
    }, []), _ = y((r) => {
      const m = N[r.id] || [], w = r.name && r.name !== r.id ? N[r.name] || [] : [];
      if (!w.length) return m;
      if (!m.length) return w;
      const v = new Set(m.map((O) => O.id)), C = [...m];
      for (const O of w)
        v.has(O.id) || C.push(O);
      return C.sort((O, S) => (S.created_at || 0) - (O.created_at || 0)), C;
    }, [N]);
    b(() => {
      k();
    }, [k]), b(() => {
      const r = () => k();
      return window.addEventListener("aw-presentation-update", r), () => window.removeEventListener("aw-presentation-update", r);
    }, [k]);
    const o = E({});
    b(() => {
      const r = (m) => {
        var v;
        const w = (v = m.detail) == null ? void 0 : v.taskId;
        w && (x((C) => ({ ...C, [w]: !0 })), setTimeout(() => {
          const C = o.current[w];
          C && C.scrollIntoView && C.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60));
      };
      return window.addEventListener("aw-focus-task", r), () => window.removeEventListener("aw-focus-task", r);
    }, []);
    const M = async (r) => {
      try {
        await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r)}/run`), { method: "POST" }), l();
      } catch (m) {
        c(String(m));
      }
    }, R = async (r) => {
      if (confirm("Delete this task and its bound terminal session?"))
        try {
          await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r)}`), { method: "DELETE" }), l();
        } catch (m) {
          c(String(m));
        }
    }, B = async (r) => {
      try {
        await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r.id)}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !r.enabled })
        }), l();
      } catch (m) {
        c(String(m));
      }
    }, j = async (r, m) => {
      const w = (m == null ? void 0 : m.session_id) || (r == null ? void 0 : r.session_id);
      if (!w) {
        c(m ? "That run never reached a terminal session — see its error." : "This task has no terminal session yet — run it once first.");
        return;
      }
      if (typeof window.__awOpenTerminal != "function") {
        c("This workspace shell cannot open terminal windows.");
        return;
      }
      window.__awOpenTerminal(w);
    };
    return /* @__PURE__ */ e.h("div", { className: "p-4 w-full" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("h1", { className: "text-sm font-semibold text-[var(--color-text-primary)]" }, "Scheduled Tasks"), /* @__PURE__ */ e.h("p", { className: "text-[11px] text-[var(--color-text-muted)] mt-0.5" }, 'Each task fires its prompt into a single reusable CLI session named "Task: ', "<name>", '".')), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => s("new"),
        className: "px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25"
      },
      "+ New task"
    )), $ && /* @__PURE__ */ e.h("div", { className: "mb-3 px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, $), u && /* @__PURE__ */ e.h("div", { className: "mb-3 px-2 py-1.5 text-[11px] rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30" }, u, " Reload the page to resume."), t.length === 0 ? /* @__PURE__ */ e.h("div", { className: "px-3 py-12 text-center text-xs text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-border)] rounded" }, 'No tasks yet. Click "+ New task" to create one.') : /* @__PURE__ */ e.h("div", { className: "border border-[var(--color-border)] rounded overflow-hidden" }, /* @__PURE__ */ e.h("div", { style: W, className: "items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)] border-b border-[var(--color-border)]" }, /* @__PURE__ */ e.h("span", null, "Name"), /* @__PURE__ */ e.h("span", null, "CLI"), /* @__PURE__ */ e.h("span", null, "Schedule"), /* @__PURE__ */ e.h("span", null, "On"), /* @__PURE__ */ e.h("span", null, "Last run"), /* @__PURE__ */ e.h("span", null, "Presentation"), /* @__PURE__ */ e.h("span", { className: "text-right" }, "Actions")), t.map((r) => {
      const m = !!d[r.id], w = re(r.schedules);
      return /* @__PURE__ */ e.h(
        "div",
        {
          key: r.id,
          ref: (v) => {
            v ? o.current[r.id] = v : delete o.current[r.id];
          },
          className: "border-b border-[var(--color-border)] last:border-b-0"
        },
        /* @__PURE__ */ e.h("div", { style: W, className: "items-center gap-2 px-3 py-2 hover:bg-white/[0.02]" }, /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => x((v) => ({ ...v, [r.id]: !m })),
            className: "flex items-center gap-1.5 text-left min-w-0"
          },
          /* @__PURE__ */ e.h("span", { className: "text-[var(--color-text-muted)] text-[10px] w-2.5" }, m ? "▼" : "▶"),
          /* @__PURE__ */ e.h("span", { className: "text-xs text-[var(--color-text-primary)] truncate" }, r.name),
          r.agent_session_id && /* @__PURE__ */ e.h(
            "span",
            {
              className: "text-[9px] font-mono text-[var(--color-text-muted)] shrink-0",
              title: `Agent conversation: ${r.agent_session_id}`
            },
            r.agent_session_id.length > 12 ? r.agent_session_id.slice(0, 8) : r.agent_session_id
          )
        ), /* @__PURE__ */ e.h("span", { className: "text-[11px] font-mono text-[var(--color-text-muted)] truncate flex items-center gap-1" }, r.type === "agent_prompt" || r.type === "agentic_output" ? `agent:${r.agent_slug || "?"}` : r.cli_type), /* @__PURE__ */ e.h(
          "span",
          {
            className: "text-[11px] text-[var(--color-text-muted)] truncate",
            title: (r.schedules || []).map(K).join(`
`) || "—"
          },
          w
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => B(r),
            className: `text-[10px] px-1.5 py-0.5 rounded ${r.enabled ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10"}`,
            title: r.enabled ? "Disable" : "Enable"
          },
          r.enabled ? "on" : "off"
        ), /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5" }, /* @__PURE__ */ e.h(q, { status: r.last_run_status }), /* @__PURE__ */ e.h("span", { title: I(r.last_run_at) }, te(r.last_run_at))), (() => {
          const v = _(r).length;
          return /* @__PURE__ */ e.h(
            "button",
            {
              onClick: () => x((C) => ({ ...C, [r.id]: !m })),
              title: v > 0 ? `${v} presentation${v === 1 ? "" : "es"} — click to expand` : "No presentations for this task",
              disabled: v === 0,
              className: `flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${v > 0 ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 cursor-pointer" : "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"}`
            },
            /* @__PURE__ */ e.h("svg", { className: "w-3 h-3", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), /* @__PURE__ */ e.h("path", { d: "M3 9h18M9 3v18" })),
            /* @__PURE__ */ e.h("span", { className: "font-mono" }, v)
          );
        })(), /* @__PURE__ */ e.h("span", { className: "flex items-center justify-end gap-1" }, /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => M(r.id),
            title: "Run now",
            className: "p-1 rounded hover:bg-white/10 text-green-400"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ e.h("path", { d: "M8 5v14l11-7z" }))
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => j(r),
            title: r.session_id ? "Open the terminal this task ran in" : "No terminal session yet — run the task once",
            disabled: !r.session_id,
            className: "p-1 rounded hover:bg-white/10 text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("polyline", { points: "4 17 10 11 4 5" }), /* @__PURE__ */ e.h("line", { x1: "12", y1: "19", x2: "20", y2: "19" }))
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => s(r),
            title: "Edit",
            className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), /* @__PURE__ */ e.h("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" }))
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => R(r.id),
            title: "Delete",
            className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ e.h("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }), /* @__PURE__ */ e.h("path", { d: "M10 11v6M14 11v6" }), /* @__PURE__ */ e.h("path", { d: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" }))
        ))),
        m && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h(ce, { task: r, onOpen: (v) => j(r, v) }), /* @__PURE__ */ e.h(se, { task: r, presentations: _(r) }))
      );
    })), n && /* @__PURE__ */ e.h(
      oe,
      {
        task: n === "new" ? null : n,
        onClose: () => s(null),
        onSaved: () => {
          s(null), l();
        }
      }
    ));
  }
  e.registerSlot("core.nav.workspace", f), e.registerWindow("tasks.main", ie);
}
export {
  ye as default,
  ye as register
};
