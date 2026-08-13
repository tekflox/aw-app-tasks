function ce({ apiUrl: e, fetchImpl: O = fetch }) {
  async function g() {
    const _ = await O(e("/tasks"));
    if (!_.ok) throw new Error(`GET /tasks -> ${_.status}`);
    return (await _.json()).tasks || [];
  }
  async function R(_) {
    const k = await O(e(`/tasks/${encodeURIComponent(_)}/run`), { method: "POST" }), A = await k.json().catch(() => ({}));
    if (!k.ok) throw new Error(A.detail || A.error || `POST /tasks/${_}/run -> ${k.status}`);
    return A;
  }
  return { listTasks: g, runTask: R };
}
function ie(e) {
  const O = ce({
    apiUrl: e.app.apiUrl,
    fetchImpl: e.sdk.api.fetch
  }), { useState: g, useRef: R, useCallback: _, useEffect: k } = e.React;
  function A() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ e.h("polyline", { points: "12 6 12 12 16 14" }));
  }
  function G() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3 h-3", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ e.h("path", { d: "M8 5v14l11-7z" }));
  }
  function J(t) {
    const a = t.schedules || [];
    if (a.length === 0) return "manual";
    if (a.length > 1) return `${a.length} schedules`;
    const l = a[0];
    return l.kind === "cron" ? l.expr || "cron" : l.kind || "scheduled";
  }
  function Y() {
    const [t, a] = g(!1), [l, s] = g([]), [m, x] = g(null), [C, c] = g(null), o = R(null), d = _(async () => {
      try {
        s(await O.listTasks()), x(null);
      } catch (n) {
        x(String(n.message || n));
      }
    }, []);
    k(() => {
      d();
      const n = () => d();
      return window.addEventListener("aw-task-update", n), () => window.removeEventListener("aw-task-update", n);
    }, [d]), k(() => () => clearTimeout(o.current), []);
    const y = _(() => {
      clearTimeout(o.current), a(!0), d();
    }, [d]), p = _(() => {
      o.current = setTimeout(() => a(!1), 150);
    }, []), w = _(() => {
      var n;
      a(!1), (n = window.__awOpenAppWindow) == null || n.call(window, "tasks.main");
    }, []), f = _(async (n) => {
      c(n.id), x(null);
      try {
        await O.runTask(n.id), await d();
      } catch (S) {
        x(`${n.name}: ${S.message || S}`);
      } finally {
        c(null);
      }
    }, [d]);
    return /* @__PURE__ */ e.h("div", { className: "relative", onMouseEnter: y, onMouseLeave: p }, /* @__PURE__ */ e.h(
      "div",
      {
        onClick: w,
        className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer"
      },
      /* @__PURE__ */ e.h(A, null),
      /* @__PURE__ */ e.h("span", { className: "flex-1 text-[13px] text-[var(--color-text-primary)]" }, "Tasks"),
      l.length > 0 && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)]" }, l.length),
      /* @__PURE__ */ e.h("svg", { className: "w-3 h-3 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M9 6l6 6-6 6" }))
    ), t && /* @__PURE__ */ e.h(
      "div",
      {
        className: "absolute left-full top-0 ml-1 z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-2",
        style: { minWidth: 320, maxWidth: 420 }
      },
      /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between px-2 py-1 mb-1" }, /* @__PURE__ */ e.h("span", { className: "text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" }, "Tasks · ", l.length), /* @__PURE__ */ e.h(
        "button",
        {
          onClick: w,
          className: "text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors",
          title: "Open Tasks window"
        },
        "Open all →"
      )),
      m && /* @__PURE__ */ e.h("div", { className: "mx-1 mb-2 px-2 py-1 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, m),
      l.length === 0 ? /* @__PURE__ */ e.h("div", { className: "px-3 py-6 text-center text-xs text-[var(--color-text-muted)] italic" }, 'No tasks yet. Click "Open all →" to create one.') : /* @__PURE__ */ e.h("div", { className: "overflow-y-auto", style: { maxHeight: "70vh" } }, l.map((n) => {
        const S = C === n.id, T = n.last_run_status === "ok" ? "bg-green-400" : n.last_run_status === "error" ? "bg-red-400" : n.last_run_status === "running" ? "bg-blue-400" : "bg-white/20";
        return /* @__PURE__ */ e.h(
          "div",
          {
            key: n.id,
            className: "group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.05]",
            title: n.name
          },
          /* @__PURE__ */ e.h("span", { className: `w-1.5 h-1.5 rounded-full shrink-0 ${T}` }),
          /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ e.h("span", { className: "text-[13px] text-[var(--color-text-primary)] truncate" }, n.name), !n.enabled && /* @__PURE__ */ e.h("span", { className: "px-1 py-0.5 rounded text-[9px] bg-white/5 text-[var(--color-text-muted)] shrink-0" }, "off")), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] truncate font-mono" }, n.type === "agent_prompt" || n.type === "agentic_output" ? n.type : n.cli_type, " · ", J(n))),
          /* @__PURE__ */ e.h(
            "button",
            {
              onClick: (M) => {
                M.stopPropagation(), f(n);
              },
              disabled: S,
              className: "p-1 rounded hover:bg-white/10 text-green-400 disabled:opacity-50 shrink-0",
              title: "Run now"
            },
            S ? /* @__PURE__ */ e.h("svg", { className: "w-3 h-3 animate-spin", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10", opacity: "0.25" }), /* @__PURE__ */ e.h("path", { d: "M4 12a8 8 0 0 1 8-8" })) : /* @__PURE__ */ e.h(G, null)
          )
        );
      }))
    ));
  }
  const W = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], I = { display: "grid", gridTemplateColumns: "minmax(160px,1fr) 90px minmax(160px,1fr) 60px 120px 70px 140px" }, K = { display: "grid", gridTemplateColumns: "160px 70px 60px 1fr" };
  function L(t) {
    return t ? new Date(t * 1e3).toLocaleString() : "—";
  }
  function V(t) {
    if (!t) return "—";
    const a = Date.now() / 1e3 - t;
    return a < 60 ? `${Math.floor(a)}s ago` : a < 3600 ? `${Math.floor(a / 60)}m ago` : a < 86400 ? `${Math.floor(a / 3600)}h ago` : `${Math.floor(a / 86400)}d ago`;
  }
  function B({ status: t }) {
    const a = t === "ok" ? "bg-green-500/15 text-green-400" : t === "error" ? "bg-red-500/15 text-red-400" : t === "running" ? "bg-blue-500/15 text-blue-400" : "bg-white/5 text-[var(--color-text-muted)]";
    return /* @__PURE__ */ e.h("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-mono ${a}` }, t || "—");
  }
  function D(t) {
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
        return `Weekly ${(t.days || []).map((l) => W[l] || l).join("/")} ${t.time}`;
      case "monthly":
        return `Monthly day ${t.day_of_month} at ${t.time}`;
      case "cron":
        return `Cron · ${t.expr}`;
      default:
        return JSON.stringify(t);
    }
  }
  function q(t) {
    return !t || !t.length ? "—" : t.length === 1 ? D(t[0]) : `${t.length} schedules`;
  }
  function U(t) {
    const a = /* @__PURE__ */ new Date(), l = (m) => String(m).padStart(2, "0"), s = `${l(a.getHours())}:${l(Math.min(59, a.getMinutes()))}`;
    switch (t) {
      case "once": {
        const m = new Date(a.getTime() + 36e5);
        return { kind: "once", at: `${m.getFullYear()}-${l(m.getMonth() + 1)}-${l(m.getDate())}T${l(m.getHours())}:${l(m.getMinutes())}` };
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
  function E(t) {
    return `bg-[var(--color-bg-primary)] border rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] ${t ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`;
  }
  function Q({ value: t, error: a, onChange: l, onRemove: s, nextFireAt: m }) {
    const x = t.kind, C = (o) => l(U(o)), c = (o) => l({ ...t, ...o });
    return /* @__PURE__ */ e.h("div", { className: "border border-[var(--color-border)] rounded p-2 bg-[var(--color-bg-primary)]/40" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2 mb-2" }, /* @__PURE__ */ e.h(
      "select",
      {
        value: x,
        onChange: (o) => C(o.target.value),
        className: E(!1) + " shrink-0"
      },
      /* @__PURE__ */ e.h("option", { value: "once" }, "Once"),
      /* @__PURE__ */ e.h("option", { value: "daily" }, "Daily"),
      /* @__PURE__ */ e.h("option", { value: "weekly" }, "Weekly"),
      /* @__PURE__ */ e.h("option", { value: "monthly" }, "Monthly"),
      /* @__PURE__ */ e.h("option", { value: "cron" }, "Cron (advanced)")
    ), /* @__PURE__ */ e.h("span", { className: "flex-1" }), m && !a && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)] truncate" }, "Next: ", /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-accent)]" }, L(m))), /* @__PURE__ */ e.h(
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
        onChange: (o) => c({ at: o.target.value }),
        className: E(!!a) + " w-full"
      }
    ), x === "daily" && /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] w-12" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (o) => c({ time: o.target.value }),
        className: E(!!a)
      }
    )), x === "weekly" && /* @__PURE__ */ e.h("div", { className: "space-y-2" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1 flex-wrap" }, W.map((o, d) => {
      const y = (t.days || []).includes(d);
      return /* @__PURE__ */ e.h(
        "button",
        {
          key: d,
          type: "button",
          onClick: () => {
            const p = new Set(t.days || []);
            y ? p.delete(d) : p.add(d), c({ days: [...p].sort((w, f) => w - f) });
          },
          className: `px-2 py-1 text-[11px] rounded border ${y ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30" : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-white/5"}`
        },
        o
      );
    })), /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] w-12" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (o) => c({ time: o.target.value }),
        className: E(!!a)
      }
    ))), x === "monthly" && /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "on day"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "number",
        min: 1,
        max: 31,
        value: t.day_of_month ?? 1,
        onChange: (o) => c({ day_of_month: Number(o.target.value) }),
        className: E(!!a) + " w-16"
      }
    ), /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (o) => c({ time: o.target.value }),
        className: E(!!a)
      }
    )), x === "cron" && /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h(
      "input",
      {
        type: "text",
        value: t.expr || "",
        placeholder: "0 9 * * *",
        onChange: (o) => c({ expr: o.target.value }),
        className: E(!!a) + " w-full font-mono"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "5 fields: minute hour day-of-month month day-of-week. Examples:", /* @__PURE__ */ e.h("span", { className: "font-mono" }, " */15 * * * *"), ",", " ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "0 9 * * 1-5"), ",", " ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "@hourly"), ".")), a && /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-danger)] mt-1" }, a));
  }
  function X({ schedules: t, onChange: a }) {
    const [l, s] = g(null);
    k(() => {
      if (!t.length) {
        s(null);
        return;
      }
      const c = setTimeout(async () => {
        try {
          const d = await (await e.sdk.api.fetch(e.app.apiUrl("/preview-schedules"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ schedules: t })
          })).json();
          s(d);
        } catch {
          s({ ok: !1, entries: [], error: "Network error" });
        }
      }, 300);
      return () => clearTimeout(c);
    }, [t]);
    const m = (c, o) => {
      const d = t.slice();
      d[c] = o, a(d);
    }, x = (c) => a(t.filter((o, d) => d !== c)), C = (c) => a([...t, U(c)]);
    return /* @__PURE__ */ e.h("div", { className: "space-y-2" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" }, "Schedules"), /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)]" }, l != null && l.next_fire_at ? /* @__PURE__ */ e.h(e.React.Fragment, null, "Next fires: ", /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-accent)]" }, L(l.next_fire_at))) : t.length === 0 ? "No schedule — runs only on manual ▶" : "No upcoming fire")), t.map((c, o) => {
      var y;
      const d = (y = l == null ? void 0 : l.entries) == null ? void 0 : y.find((p) => p.index === o);
      return /* @__PURE__ */ e.h(
        Q,
        {
          key: o,
          value: c,
          error: d && !d.ok ? d.error : null,
          nextFireAt: d == null ? void 0 : d.next_fire_at,
          onChange: (p) => m(o, p),
          onRemove: () => x(o)
        }
      );
    }), /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5 flex-wrap pt-1" }, /* @__PURE__ */ e.h("span", { className: "text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mr-1" }, "Add:"), [
      ["once", "Once"],
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
      ["cron", "Cron"]
    ].map(([c, o]) => /* @__PURE__ */ e.h(
      "button",
      {
        key: c,
        type: "button",
        onClick: () => C(c),
        className: "px-2 py-1 text-[11px] rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
      },
      "+ ",
      o
    ))));
  }
  function j({ checked: t, onChange: a, disabled: l, label: s, tone: m = "danger" }) {
    const x = m === "ok" ? "bg-green-500" : "bg-[var(--color-danger)]";
    return /* @__PURE__ */ e.h(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": t,
        disabled: l,
        onClick: () => !l && a(!t),
        title: s,
        className: `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${l ? "bg-white/5 cursor-not-allowed" : t ? x : "bg-white/10 hover:bg-white/15"}`
      },
      /* @__PURE__ */ e.h(
        "span",
        {
          className: `inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${t ? "translate-x-[18px]" : "translate-x-0.5"}`
        }
      )
    );
  }
  function Z({ task: t, onClose: a, onSaved: l }) {
    const s = !t, [m, x] = g((t == null ? void 0 : t.name) || ""), [C, c] = g((t == null ? void 0 : t.prompt) || ""), [o, d] = g((t == null ? void 0 : t.schedules) || []), [y, p] = g((t == null ? void 0 : t.enabled) ?? !0), [w, f] = g(null), [n, S] = g(!1), [T, M] = g((t == null ? void 0 : t.type) || "terminal"), [r, u] = g((t == null ? void 0 : t.agent_slug) || ""), [b, v] = g((t == null ? void 0 : t.reuse_session) ?? !1), [h, $] = g((t == null ? void 0 : t.command) || ""), [N, ne] = g((t == null ? void 0 : t.notify_exit_codes) || ""), [z, F] = g([]);
    k(() => {
      e.sdk.api.fetch(e.app.apiUrl("/agents")).then((i) => i.json()).then((i) => F(i.ap_agents || [])).catch(() => F([]));
    }, []);
    const oe = {
      terminal: "Terminal",
      agent_prompt: "Agent Prompt",
      agentic_output: "Agentic Output"
    }, le = async () => {
      if (f(null), !m.trim()) {
        f("Name is required.");
        return;
      }
      if (T === "agent_prompt" && !r) {
        f("Pick an agent.");
        return;
      }
      if (T === "agentic_output") {
        if (!h.trim()) {
          f("Command is required.");
          return;
        }
        if (!r) {
          f("Pick an agent.");
          return;
        }
      }
      S(!0);
      try {
        const i = s ? e.app.apiUrl("/tasks") : e.app.apiUrl(`/tasks/${encodeURIComponent(t.id)}`), se = s ? "POST" : "PUT", H = await e.sdk.api.fetch(i, {
          method: se,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: m.trim(),
            type: T,
            cli_type: "terminal",
            prompt: C,
            schedules: o,
            enabled: y,
            agent_slug: r,
            reuse_session: b,
            command: h,
            notify_exit_codes: N
          })
        }), P = await H.json();
        if (!H.ok) {
          f((P == null ? void 0 : P.error) || "Save failed");
          return;
        }
        l(P);
      } catch (i) {
        f(String(i));
      } finally {
        S(!1);
      }
    };
    return /* @__PURE__ */ e.h("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" }, /* @__PURE__ */ e.h("div", { className: "bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]" }, /* @__PURE__ */ e.h("h2", { className: "text-sm font-semibold text-[var(--color-text-primary)]" }, s ? "New task" : `Edit task — ${t.name}`), /* @__PURE__ */ e.h("button", { onClick: a, className: "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg" }, "×")), /* @__PURE__ */ e.h("div", { className: "p-4 space-y-4" }, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Name"), /* @__PURE__ */ e.h(
      "input",
      {
        autoFocus: !0,
        value: m,
        onChange: (i) => x(i.target.value),
        placeholder: "e.g. Daily standup digest",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "The bound terminal session will be named ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, '"Task: ', m || "<name>", '"'), ".")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Type"), /* @__PURE__ */ e.h("div", { className: "flex rounded border border-[var(--color-border)] overflow-hidden w-fit" }, ["terminal", "agent_prompt", "agentic_output"].map((i) => /* @__PURE__ */ e.h(
      "button",
      {
        key: i,
        type: "button",
        onClick: () => M(i),
        className: `px-3 py-1.5 text-xs border-r border-[var(--color-border)] last:border-r-0 ${T === i ? "bg-[var(--color-accent)] text-white font-semibold" : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"}`
      },
      oe[i]
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
        value: r,
        onChange: (i) => u(i.target.value),
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ e.h("option", { value: "" }, "— pick an agent —"),
      z.map((i) => /* @__PURE__ */ e.h("option", { key: i.slug, value: i.slug }, i.name || i.slug))
    )), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Prompt"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: C,
        onChange: (i) => c(i.target.value),
        rows: 6,
        placeholder: "The prompt sent to the agent when this task runs.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    )), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(j, { checked: b, onChange: v, label: "Reuse session", tone: "ok" }), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Reuse session"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "First run creates the agent session; later runs resume it to keep context.")))), T === "agentic_output" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Command"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: h,
        onChange: (i) => $(i.target.value),
        rows: 3,
        placeholder: "Cheap shell command to run first, e.g. a diff/check script — no LLM cost.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Runs on every fire. The agent below is only invoked when the exit code is notable — this is what keeps the type cheap.")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Notify on exit code"), /* @__PURE__ */ e.h(
      "input",
      {
        value: N,
        onChange: (i) => ne(i.target.value),
        placeholder: "blank = any non-zero · or a list like 1,2,127",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, `Which exit codes count as "there's a difference" and trigger the agent below. Leave blank for any non-zero.`)), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Agent ", /* @__PURE__ */ e.h("span", { className: "normal-case text-[var(--color-text-muted)]" }, "(Agents Platform)")), /* @__PURE__ */ e.h(
      "select",
      {
        value: r,
        onChange: (i) => u(i.target.value),
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ e.h("option", { value: "" }, "— pick an agent —"),
      z.map((i) => /* @__PURE__ */ e.h("option", { key: i.slug, value: i.slug }, i.name || i.slug))
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Only invoked on a notable exit code — with your prompt below plus the command's captured output appended.")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Prompt"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: C,
        onChange: (i) => c(i.target.value),
        rows: 6,
        placeholder: "Instructions for the agent — what to do with the command's output when there's a difference.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    )), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(j, { checked: b, onChange: v, label: "Reuse session", tone: "ok" }), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Reuse session"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "First triggered run creates the agent session; later runs resume it to keep context.")))), /* @__PURE__ */ e.h(X, { schedules: o, onChange: d }), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(
      j,
      {
        checked: y,
        onChange: p,
        label: "Enabled",
        tone: "ok"
      }
    ), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Enabled"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "When off, scheduled fires are skipped. Manual ▶ Run-now still works."))), w && /* @__PURE__ */ e.h("div", { className: "px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, w)), /* @__PURE__ */ e.h("div", { className: "flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h(
      "button",
      {
        onClick: a,
        className: "px-3 py-1.5 text-xs rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      },
      "Cancel"
    ), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: le,
        disabled: n,
        className: "px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 disabled:opacity-50"
      },
      n ? "Saving…" : s ? "Create task" : "Save changes"
    ))));
  }
  function ee({ presentation: t, hideTaskTags: a, onClick: l }) {
    const s = R(null), m = R(null), [x, C] = g(0.18), c = 1e3, o = 650, d = o / c;
    k(() => {
      const p = m.current;
      if (!p || typeof ResizeObserver > "u") return;
      const w = new ResizeObserver((f) => {
        for (const n of f) {
          const S = n.contentRect.width;
          S > 0 && C(S / c);
        }
      });
      return w.observe(p), () => w.disconnect();
    }, []), k(() => {
      const p = s.current;
      if (!(!p || !(t != null && t.html)))
        try {
          const w = p.contentDocument;
          w.open();
          const f = "<style>html,body{margin:0;padding:0;overflow:hidden;}*{max-width:100%;box-sizing:border-box;}</style>";
          let n = t.html;
          n = n.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""), n = n.replace(/\s+on\w+="[^"]*"/gi, ""), n = n.replace(/\s+on\w+='[^']*'/gi, ""), n.includes("<head>") ? n = n.replace("<head>", "<head>" + f) : n.includes("<html>") ? n = n.replace("<html>", "<html><head>" + f + "</head>") : n = f + n, w.write(n), w.close();
        } catch {
        }
    }, [t == null ? void 0 : t.html]);
    const y = (t.tags || []).filter((p) => !a || !a.has(p));
    return /* @__PURE__ */ e.h(
      "div",
      {
        onClick: l,
        className: "group rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden cursor-pointer hover:border-[var(--color-accent)] transition-colors",
        title: t.title || t.id
      },
      /* @__PURE__ */ e.h(
        "div",
        {
          ref: m,
          className: "relative bg-[var(--color-bg-primary)]",
          style: { width: "100%", paddingTop: `${d * 100}%`, overflow: "hidden" }
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
              height: o,
              border: 0,
              pointerEvents: "none",
              transform: `scale(${x})`,
              transformOrigin: "top left"
            }
          }
        )
      ),
      /* @__PURE__ */ e.h("div", { className: "px-2 py-1.5 border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h("div", { className: "text-[11px] font-medium text-[var(--color-text-primary)] truncate" }, t.title || "Untitled"), y.length > 0 && /* @__PURE__ */ e.h("div", { className: "flex flex-wrap gap-0.5 mt-0.5 overflow-hidden", style: { maxHeight: 16 } }, y.slice(0, 3).map((p) => /* @__PURE__ */ e.h(
        "span",
        {
          key: p,
          className: "text-[8px] font-mono leading-none px-1 py-[2px] rounded bg-white/5 border border-white/10 text-[var(--color-text-muted)] truncate",
          title: p
        },
        p
      )), y.length > 3 && /* @__PURE__ */ e.h("span", { className: "text-[8px] leading-none px-1 py-[2px] text-[var(--color-text-muted)]", title: y.slice(3).join(", ") }, "+", y.length - 3)), /* @__PURE__ */ e.h("div", { className: "text-[9px] text-[var(--color-text-muted)] truncate mt-0.5" }, L(t.created_at)))
    );
  }
  function te({ task: t, presentations: a }) {
    const l = (m) => {
      var x;
      (x = window.__awOpenPresentation) == null || x.call(window, m);
    };
    if (!a || a.length === 0)
      return /* @__PURE__ */ e.h("div", { className: "px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic border-t border-[var(--color-border)]" }, "No generated assets yet. Presentations produced inside this task's bound session are tagged ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "task:", t.id), " automatically.");
    const s = /* @__PURE__ */ new Set([`task:${t.id}`]);
    return t.name && t.name !== t.id && s.add(`task:${t.name}`), /* @__PURE__ */ e.h("div", { className: "border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h("div", { className: "px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)]/40" }, "Generated assets (", a.length, ")"), /* @__PURE__ */ e.h("div", { className: "flex gap-2 p-3 overflow-x-auto overflow-y-hidden" }, a.map((m) => /* @__PURE__ */ e.h("div", { key: m.id, className: "shrink-0", style: { width: 200 } }, /* @__PURE__ */ e.h(ee, { presentation: m, hideTaskTags: s, onClick: () => l(m.id) })))));
  }
  function re({ task: t, onOpen: a }) {
    const l = t.runs || [];
    return l.length ? /* @__PURE__ */ e.h("div", { className: "border-t border-[var(--color-border)]" }, l.map((s) => /* @__PURE__ */ e.h(
      "div",
      {
        key: s.id,
        onClick: () => a(s),
        style: K,
        className: "items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-white/[0.03] cursor-pointer",
        title: s.session_id ? "Click to open the terminal this run used" : "This run never reached a terminal session"
      },
      /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-text-muted)]" }, L(s.started_at)),
      /* @__PURE__ */ e.h("span", { className: "text-[var(--color-text-muted)]" }, s.trigger),
      /* @__PURE__ */ e.h(B, { status: s.status }),
      /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-text-muted)] truncate" }, s.error || "")
    ))) : /* @__PURE__ */ e.h("div", { className: "px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic" }, "No runs yet.");
  }
  function ae() {
    const [t, a] = g([]), [l, s] = g(null), [m, x] = g({}), [C, c] = g(null), o = _(async () => {
      try {
        const u = await (await e.sdk.api.fetch(e.app.apiUrl("/tasks"))).json();
        a(u.tasks || []);
      } catch (r) {
        c(String(r));
      }
    }, []);
    k(() => {
      o();
    }, [o]), k(() => {
      const r = () => o();
      return window.addEventListener("aw-task-update", r), () => window.removeEventListener("aw-task-update", r);
    }, [o]);
    const [d, y] = g({}), p = _(async () => {
      try {
        const u = await (await e.sdk.api.fetch("/api/apps/presentations/presentations")).json(), b = {}, v = {};
        for (const h of Array.isArray(u) ? u : []) {
          const $ = /* @__PURE__ */ new Set();
          for (const N of h.tags || [])
            typeof N == "string" && N.startsWith("task:") && $.add(N.slice(5));
          for (const N of $)
            v[N] || (v[N] = /* @__PURE__ */ new Set()), !v[N].has(h.id) && (v[N].add(h.id), (b[N] = b[N] || []).push(h));
        }
        for (const h of Object.keys(b))
          b[h].sort(($, N) => (N.created_at || 0) - ($.created_at || 0));
        y(b);
      } catch {
      }
    }, []), w = _((r) => {
      const u = d[r.id] || [], b = r.name && r.name !== r.id ? d[r.name] || [] : [];
      if (!b.length) return u;
      if (!u.length) return b;
      const v = new Set(u.map(($) => $.id)), h = [...u];
      for (const $ of b)
        v.has($.id) || h.push($);
      return h.sort(($, N) => (N.created_at || 0) - ($.created_at || 0)), h;
    }, [d]);
    k(() => {
      p();
    }, [p]), k(() => {
      const r = () => p();
      return window.addEventListener("aw-presentation-update", r), () => window.removeEventListener("aw-presentation-update", r);
    }, [p]);
    const f = R({});
    k(() => {
      const r = (u) => {
        var v;
        const b = (v = u.detail) == null ? void 0 : v.taskId;
        b && (x((h) => ({ ...h, [b]: !0 })), setTimeout(() => {
          const h = f.current[b];
          h && h.scrollIntoView && h.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60));
      };
      return window.addEventListener("aw-focus-task", r), () => window.removeEventListener("aw-focus-task", r);
    }, []);
    const n = async (r) => {
      try {
        await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r)}/run`), { method: "POST" }), o();
      } catch (u) {
        c(String(u));
      }
    }, S = async (r) => {
      if (confirm("Delete this task and its bound terminal session?"))
        try {
          await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r)}`), { method: "DELETE" }), o();
        } catch (u) {
          c(String(u));
        }
    }, T = async (r) => {
      try {
        await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r.id)}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !r.enabled })
        }), o();
      } catch (u) {
        c(String(u));
      }
    }, M = async (r, u) => {
      const b = (u == null ? void 0 : u.session_id) || (r == null ? void 0 : r.session_id);
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
    )), C && /* @__PURE__ */ e.h("div", { className: "mb-3 px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, C), t.length === 0 ? /* @__PURE__ */ e.h("div", { className: "px-3 py-12 text-center text-xs text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-border)] rounded" }, 'No tasks yet. Click "+ New task" to create one.') : /* @__PURE__ */ e.h("div", { className: "border border-[var(--color-border)] rounded overflow-hidden" }, /* @__PURE__ */ e.h("div", { style: I, className: "items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)] border-b border-[var(--color-border)]" }, /* @__PURE__ */ e.h("span", null, "Name"), /* @__PURE__ */ e.h("span", null, "CLI"), /* @__PURE__ */ e.h("span", null, "Schedule"), /* @__PURE__ */ e.h("span", null, "On"), /* @__PURE__ */ e.h("span", null, "Last run"), /* @__PURE__ */ e.h("span", null, "Presentation"), /* @__PURE__ */ e.h("span", { className: "text-right" }, "Actions")), t.map((r) => {
      const u = !!m[r.id], b = q(r.schedules);
      return /* @__PURE__ */ e.h(
        "div",
        {
          key: r.id,
          ref: (v) => {
            v ? f.current[r.id] = v : delete f.current[r.id];
          },
          className: "border-b border-[var(--color-border)] last:border-b-0"
        },
        /* @__PURE__ */ e.h("div", { style: I, className: "items-center gap-2 px-3 py-2 hover:bg-white/[0.02]" }, /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => x((v) => ({ ...v, [r.id]: !u })),
            className: "flex items-center gap-1.5 text-left min-w-0"
          },
          /* @__PURE__ */ e.h("span", { className: "text-[var(--color-text-muted)] text-[10px] w-2.5" }, u ? "▼" : "▶"),
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
            title: (r.schedules || []).map(D).join(`
`) || "—"
          },
          b
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => T(r),
            className: `text-[10px] px-1.5 py-0.5 rounded ${r.enabled ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10"}`,
            title: r.enabled ? "Disable" : "Enable"
          },
          r.enabled ? "on" : "off"
        ), /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5" }, /* @__PURE__ */ e.h(B, { status: r.last_run_status }), /* @__PURE__ */ e.h("span", { title: L(r.last_run_at) }, V(r.last_run_at))), (() => {
          const v = w(r).length;
          return /* @__PURE__ */ e.h(
            "button",
            {
              onClick: () => x((h) => ({ ...h, [r.id]: !u })),
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
            onClick: () => n(r.id),
            title: "Run now",
            className: "p-1 rounded hover:bg-white/10 text-green-400"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ e.h("path", { d: "M8 5v14l11-7z" }))
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => M(r),
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
            onClick: () => S(r.id),
            title: "Delete",
            className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
          },
          /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ e.h("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }), /* @__PURE__ */ e.h("path", { d: "M10 11v6M14 11v6" }), /* @__PURE__ */ e.h("path", { d: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" }))
        ))),
        u && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h(re, { task: r, onOpen: (v) => M(r, v) }), /* @__PURE__ */ e.h(te, { task: r, presentations: w(r) }))
      );
    })), l && /* @__PURE__ */ e.h(
      Z,
      {
        task: l === "new" ? null : l,
        onClose: () => s(null),
        onSaved: () => {
          s(null), o();
        }
      }
    ));
  }
  e.registerSlot("core.nav.workspace", Y), e.registerWindow("tasks.main", ae);
}
export {
  ie as default,
  ie as register
};
