function le({ apiUrl: e, fetchImpl: A = fetch }) {
  async function x() {
    const _ = await A(e("/tasks"));
    if (!_.ok) throw new Error(`GET /tasks -> ${_.status}`);
    return (await _.json()).tasks || [];
  }
  async function R(_) {
    const k = await A(e(`/tasks/${encodeURIComponent(_)}/run`), { method: "POST" }), L = await k.json().catch(() => ({}));
    if (!k.ok) throw new Error(L.detail || L.error || `POST /tasks/${_}/run -> ${k.status}`);
    return L;
  }
  return { listTasks: x, runTask: R };
}
function ce(e) {
  const A = le({
    apiUrl: e.app.apiUrl,
    fetchImpl: e.sdk.api.fetch
  }), { useState: x, useRef: R, useCallback: _, useEffect: k } = e.React;
  function L() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ e.h("polyline", { points: "12 6 12 12 16 14" }));
  }
  function H() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3 h-3", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ e.h("path", { d: "M8 5v14l11-7z" }));
  }
  function J(t) {
    const a = t.schedules || [];
    if (a.length === 0) return "manual";
    if (a.length > 1) return `${a.length} schedules`;
    const l = a[0];
    return l.kind === "cron" ? l.expr || "cron" : l.kind || "scheduled";
  }
  function G() {
    const [t, a] = x(!1), [l, s] = x([]), [m, p] = x(null), [C, i] = x(null), o = R(null), d = _(async () => {
      try {
        s(await A.listTasks()), p(null);
      } catch (n) {
        p(String(n.message || n));
      }
    }, []);
    k(() => {
      d();
      const n = () => d();
      return window.addEventListener("aw-task-update", n), () => window.removeEventListener("aw-task-update", n);
    }, [d]), k(() => () => clearTimeout(o.current), []);
    const y = _(() => {
      clearTimeout(o.current), a(!0), d();
    }, [d]), u = _(() => {
      o.current = setTimeout(() => a(!1), 150);
    }, []), w = _(() => {
      var n;
      a(!1), (n = window.__awOpenAppWindow) == null || n.call(window, "tasks.main");
    }, []), h = _(async (n) => {
      i(n.id), p(null);
      try {
        await A.runTask(n.id), await d();
      } catch (S) {
        p(`${n.name}: ${S.message || S}`);
      } finally {
        i(null);
      }
    }, [d]);
    return /* @__PURE__ */ e.h("div", { className: "relative", onMouseEnter: y, onMouseLeave: u }, /* @__PURE__ */ e.h(
      "div",
      {
        onClick: w,
        className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer"
      },
      /* @__PURE__ */ e.h(L, null),
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
                M.stopPropagation(), h(n);
              },
              disabled: S,
              className: "p-1 rounded hover:bg-white/10 text-green-400 disabled:opacity-50 shrink-0",
              title: "Run now"
            },
            S ? /* @__PURE__ */ e.h("svg", { className: "w-3 h-3 animate-spin", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("circle", { cx: "12", cy: "12", r: "10", opacity: "0.25" }), /* @__PURE__ */ e.h("path", { d: "M4 12a8 8 0 0 1 8-8" })) : /* @__PURE__ */ e.h(H, null)
          )
        );
      }))
    ));
  }
  const W = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function O(t) {
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
  function z(t) {
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
  function Y(t) {
    return !t || !t.length ? "—" : t.length === 1 ? z(t[0]) : `${t.length} schedules`;
  }
  function D(t) {
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
  function q({ value: t, error: a, onChange: l, onRemove: s, nextFireAt: m }) {
    const p = t.kind, C = (o) => l(D(o)), i = (o) => l({ ...t, ...o });
    return /* @__PURE__ */ e.h("div", { className: "border border-[var(--color-border)] rounded p-2 bg-[var(--color-bg-primary)]/40" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2 mb-2" }, /* @__PURE__ */ e.h(
      "select",
      {
        value: p,
        onChange: (o) => C(o.target.value),
        className: E(!1) + " shrink-0"
      },
      /* @__PURE__ */ e.h("option", { value: "once" }, "Once"),
      /* @__PURE__ */ e.h("option", { value: "daily" }, "Daily"),
      /* @__PURE__ */ e.h("option", { value: "weekly" }, "Weekly"),
      /* @__PURE__ */ e.h("option", { value: "monthly" }, "Monthly"),
      /* @__PURE__ */ e.h("option", { value: "cron" }, "Cron (advanced)")
    ), /* @__PURE__ */ e.h("span", { className: "flex-1" }), m && !a && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)] truncate" }, "Next: ", /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-accent)]" }, O(m))), /* @__PURE__ */ e.h(
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
        onChange: (o) => i({ at: o.target.value }),
        className: E(!!a) + " w-full"
      }
    ), p === "daily" && /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] w-12" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (o) => i({ time: o.target.value }),
        className: E(!!a)
      }
    )), p === "weekly" && /* @__PURE__ */ e.h("div", { className: "space-y-2" }, /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1 flex-wrap" }, W.map((o, d) => {
      const y = (t.days || []).includes(d);
      return /* @__PURE__ */ e.h(
        "button",
        {
          key: d,
          type: "button",
          onClick: () => {
            const u = new Set(t.days || []);
            y ? u.delete(d) : u.add(d), i({ days: [...u].sort((w, h) => w - h) });
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
        onChange: (o) => i({ time: o.target.value }),
        className: E(!!a)
      }
    ))), p === "monthly" && /* @__PURE__ */ e.h("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "on day"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "number",
        min: 1,
        max: 31,
        value: t.day_of_month ?? 1,
        onChange: (o) => i({ day_of_month: Number(o.target.value) }),
        className: E(!!a) + " w-16"
      }
    ), /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "at"), /* @__PURE__ */ e.h(
      "input",
      {
        type: "time",
        value: t.time || "",
        onChange: (o) => i({ time: o.target.value }),
        className: E(!!a)
      }
    )), p === "cron" && /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h(
      "input",
      {
        type: "text",
        value: t.expr || "",
        placeholder: "0 9 * * *",
        onChange: (o) => i({ expr: o.target.value }),
        className: E(!!a) + " w-full font-mono"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "5 fields: minute hour day-of-month month day-of-week. Examples:", /* @__PURE__ */ e.h("span", { className: "font-mono" }, " */15 * * * *"), ",", " ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "0 9 * * 1-5"), ",", " ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "@hourly"), ".")), a && /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-danger)] mt-1" }, a));
  }
  function K({ schedules: t, onChange: a }) {
    const [l, s] = x(null);
    k(() => {
      if (!t.length) {
        s(null);
        return;
      }
      const i = setTimeout(async () => {
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
      return () => clearTimeout(i);
    }, [t]);
    const m = (i, o) => {
      const d = t.slice();
      d[i] = o, a(d);
    }, p = (i) => a(t.filter((o, d) => d !== i)), C = (i) => a([...t, D(i)]);
    return /* @__PURE__ */ e.h("div", { className: "space-y-2" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ e.h("span", { className: "text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" }, "Schedules"), /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)]" }, l != null && l.next_fire_at ? /* @__PURE__ */ e.h(e.React.Fragment, null, "Next fires: ", /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-accent)]" }, O(l.next_fire_at))) : t.length === 0 ? "No schedule — runs only on manual ▶" : "No upcoming fire")), t.map((i, o) => {
      var y;
      const d = (y = l == null ? void 0 : l.entries) == null ? void 0 : y.find((u) => u.index === o);
      return /* @__PURE__ */ e.h(
        q,
        {
          key: o,
          value: i,
          error: d && !d.ok ? d.error : null,
          nextFireAt: d == null ? void 0 : d.next_fire_at,
          onChange: (u) => m(o, u),
          onRemove: () => p(o)
        }
      );
    }), /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5 flex-wrap pt-1" }, /* @__PURE__ */ e.h("span", { className: "text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mr-1" }, "Add:"), [
      ["once", "Once"],
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
      ["cron", "Cron"]
    ].map(([i, o]) => /* @__PURE__ */ e.h(
      "button",
      {
        key: i,
        type: "button",
        onClick: () => C(i),
        className: "px-2 py-1 text-[11px] rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
      },
      "+ ",
      o
    ))));
  }
  function j({ checked: t, onChange: a, disabled: l, label: s, tone: m = "danger" }) {
    const p = m === "ok" ? "bg-green-500" : "bg-[var(--color-danger)]";
    return /* @__PURE__ */ e.h(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": t,
        disabled: l,
        onClick: () => !l && a(!t),
        title: s,
        className: `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${l ? "bg-white/5 cursor-not-allowed" : t ? p : "bg-white/10 hover:bg-white/15"}`
      },
      /* @__PURE__ */ e.h(
        "span",
        {
          className: `inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${t ? "translate-x-[18px]" : "translate-x-0.5"}`
        }
      )
    );
  }
  function Q({ task: t, onClose: a, onSaved: l }) {
    const s = !t, [m, p] = x((t == null ? void 0 : t.name) || ""), [C, i] = x((t == null ? void 0 : t.prompt) || ""), [o, d] = x((t == null ? void 0 : t.schedules) || []), [y, u] = x((t == null ? void 0 : t.enabled) ?? !0), [w, h] = x(null), [n, S] = x(!1), [T, M] = x((t == null ? void 0 : t.type) || "terminal"), [r, v] = x((t == null ? void 0 : t.agent_slug) || ""), [f, g] = x((t == null ? void 0 : t.reuse_session) ?? !1), [b, $] = x((t == null ? void 0 : t.command) || ""), [N, re] = x((t == null ? void 0 : t.notify_exit_codes) || ""), [I, U] = x([]);
    k(() => {
      e.sdk.api.fetch("/api/whatsapp/agent-picker").then((c) => c.json()).then((c) => U(c.ap_agents || [])).catch(() => U([]));
    }, []);
    const ae = {
      terminal: "Terminal",
      agent_prompt: "Agent Prompt",
      agentic_output: "Agentic Output"
    }, ne = async () => {
      if (h(null), !m.trim()) {
        h("Name is required.");
        return;
      }
      if (T === "agent_prompt" && !r) {
        h("Pick an agent.");
        return;
      }
      if (T === "agentic_output") {
        if (!b.trim()) {
          h("Command is required.");
          return;
        }
        if (!r) {
          h("Pick an agent.");
          return;
        }
      }
      S(!0);
      try {
        const c = s ? e.app.apiUrl("/tasks") : e.app.apiUrl(`/tasks/${encodeURIComponent(t.id)}`), oe = s ? "POST" : "PUT", F = await e.sdk.api.fetch(c, {
          method: oe,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: m.trim(),
            type: T,
            cli_type: "terminal",
            prompt: C,
            schedules: o,
            enabled: y,
            agent_slug: r,
            reuse_session: f,
            command: b,
            notify_exit_codes: N
          })
        }), P = await F.json();
        if (!F.ok) {
          h((P == null ? void 0 : P.error) || "Save failed");
          return;
        }
        l(P);
      } catch (c) {
        h(String(c));
      } finally {
        S(!1);
      }
    };
    return /* @__PURE__ */ e.h("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" }, /* @__PURE__ */ e.h("div", { className: "bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]" }, /* @__PURE__ */ e.h("h2", { className: "text-sm font-semibold text-[var(--color-text-primary)]" }, s ? "New task" : `Edit task — ${t.name}`), /* @__PURE__ */ e.h("button", { onClick: a, className: "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg" }, "×")), /* @__PURE__ */ e.h("div", { className: "p-4 space-y-4" }, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Name"), /* @__PURE__ */ e.h(
      "input",
      {
        autoFocus: !0,
        value: m,
        onChange: (c) => p(c.target.value),
        placeholder: "e.g. Daily standup digest",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "The bound terminal session will be named ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, '"Task: ', m || "<name>", '"'), ".")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Type"), /* @__PURE__ */ e.h("div", { className: "flex rounded border border-[var(--color-border)] overflow-hidden w-fit" }, ["terminal", "agent_prompt", "agentic_output"].map((c) => /* @__PURE__ */ e.h(
      "button",
      {
        key: c,
        type: "button",
        onClick: () => M(c),
        className: `px-3 py-1.5 text-xs border-r border-[var(--color-border)] last:border-r-0 ${T === c ? "bg-[var(--color-accent)] text-white font-semibold" : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"}`
      },
      ae[c]
    ))), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, T === "terminal" && "Runs a CLI/command in a reusable terminal session.", T === "agent_prompt" && "Calls an Agents Platform agent with the prompt.", T === "agentic_output" && "Runs a command; on a notable exit code, a Telegram bot’s agent interprets and reports the output.")), T === "terminal" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Command"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: C,
        onChange: (c) => i(c.target.value),
        rows: 3,
        placeholder: "Shell command typed into the bash session, e.g. ./aw status",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Runs in a plain bash terminal session. Lines are executed followed by Enter — supports pipes, multiple commands separated by ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, ";"), " or ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "&&"), "."))), T === "agent_prompt" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Agent ", /* @__PURE__ */ e.h("span", { className: "normal-case text-[var(--color-text-muted)]" }, "(Agents Platform)")), /* @__PURE__ */ e.h(
      "select",
      {
        value: r,
        onChange: (c) => v(c.target.value),
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ e.h("option", { value: "" }, "— pick an agent —"),
      I.map((c) => /* @__PURE__ */ e.h("option", { key: c.slug, value: c.slug }, c.name || c.slug))
    )), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Prompt"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: C,
        onChange: (c) => i(c.target.value),
        rows: 6,
        placeholder: "The prompt sent to the agent when this task runs.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    )), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(j, { checked: f, onChange: g, label: "Reuse session", tone: "ok" }), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Reuse session"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "First run creates the agent session; later runs resume it to keep context.")))), T === "agentic_output" && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Command"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: b,
        onChange: (c) => $(c.target.value),
        rows: 3,
        placeholder: "Cheap shell command to run first, e.g. a diff/check script — no LLM cost.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Runs on every fire. The agent below is only invoked when the exit code is notable — this is what keeps the type cheap.")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Notify on exit code"), /* @__PURE__ */ e.h(
      "input",
      {
        value: N,
        onChange: (c) => re(c.target.value),
        placeholder: "blank = any non-zero · or a list like 1,2,127",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono"
      }
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, `Which exit codes count as "there's a difference" and trigger the agent below. Leave blank for any non-zero.`)), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Agent ", /* @__PURE__ */ e.h("span", { className: "normal-case text-[var(--color-text-muted)]" }, "(Agents Platform)")), /* @__PURE__ */ e.h(
      "select",
      {
        value: r,
        onChange: (c) => v(c.target.value),
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ e.h("option", { value: "" }, "— pick an agent —"),
      I.map((c) => /* @__PURE__ */ e.h("option", { key: c.slug, value: c.slug }, c.name || c.slug))
    ), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-1" }, "Only invoked on a notable exit code — with your prompt below plus the command's captured output appended.")), /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("label", { className: "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" }, "Prompt"), /* @__PURE__ */ e.h(
      "textarea",
      {
        value: C,
        onChange: (c) => i(c.target.value),
        rows: 6,
        placeholder: "Instructions for the agent — what to do with the command's output when there's a difference.",
        className: "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] font-mono resize-y"
      }
    )), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(j, { checked: f, onChange: g, label: "Reuse session", tone: "ok" }), /* @__PURE__ */ e.h("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ e.h("div", { className: "text-xs text-[var(--color-text-primary)]" }, "Reuse session"), /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mt-0.5" }, "First triggered run creates the agent session; later runs resume it to keep context.")))), /* @__PURE__ */ e.h(K, { schedules: o, onChange: d }), /* @__PURE__ */ e.h("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ e.h(
      j,
      {
        checked: y,
        onChange: u,
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
        onClick: ne,
        disabled: n,
        className: "px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 disabled:opacity-50"
      },
      n ? "Saving…" : s ? "Create task" : "Save changes"
    ))));
  }
  function X({ presentation: t, hideTaskTags: a, onClick: l }) {
    const s = R(null), m = R(null), [p, C] = x(0.18), i = 1e3, o = 650, d = o / i;
    k(() => {
      const u = m.current;
      if (!u || typeof ResizeObserver > "u") return;
      const w = new ResizeObserver((h) => {
        for (const n of h) {
          const S = n.contentRect.width;
          S > 0 && C(S / i);
        }
      });
      return w.observe(u), () => w.disconnect();
    }, []), k(() => {
      const u = s.current;
      if (!(!u || !(t != null && t.html)))
        try {
          const w = u.contentDocument;
          w.open();
          const h = "<style>html,body{margin:0;padding:0;overflow:hidden;}*{max-width:100%;box-sizing:border-box;}</style>";
          let n = t.html;
          n = n.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""), n = n.replace(/\s+on\w+="[^"]*"/gi, ""), n = n.replace(/\s+on\w+='[^']*'/gi, ""), n.includes("<head>") ? n = n.replace("<head>", "<head>" + h) : n.includes("<html>") ? n = n.replace("<html>", "<html><head>" + h + "</head>") : n = h + n, w.write(n), w.close();
        } catch {
        }
    }, [t == null ? void 0 : t.html]);
    const y = (t.tags || []).filter((u) => !a || !a.has(u));
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
              width: i,
              height: o,
              border: 0,
              pointerEvents: "none",
              transform: `scale(${p})`,
              transformOrigin: "top left"
            }
          }
        )
      ),
      /* @__PURE__ */ e.h("div", { className: "px-2 py-1.5 border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h("div", { className: "text-[11px] font-medium text-[var(--color-text-primary)] truncate" }, t.title || "Untitled"), y.length > 0 && /* @__PURE__ */ e.h("div", { className: "flex flex-wrap gap-0.5 mt-0.5 overflow-hidden", style: { maxHeight: 16 } }, y.slice(0, 3).map((u) => /* @__PURE__ */ e.h(
        "span",
        {
          key: u,
          className: "text-[8px] font-mono leading-none px-1 py-[2px] rounded bg-white/5 border border-white/10 text-[var(--color-text-muted)] truncate",
          title: u
        },
        u
      )), y.length > 3 && /* @__PURE__ */ e.h("span", { className: "text-[8px] leading-none px-1 py-[2px] text-[var(--color-text-muted)]", title: y.slice(3).join(", ") }, "+", y.length - 3)), /* @__PURE__ */ e.h("div", { className: "text-[9px] text-[var(--color-text-muted)] truncate mt-0.5" }, O(t.created_at)))
    );
  }
  function Z({ task: t, presentations: a }) {
    const l = (m) => {
      var p;
      (p = window.__awOpenPresentation) == null || p.call(window, m);
    };
    if (!a || a.length === 0)
      return /* @__PURE__ */ e.h("div", { className: "px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic border-t border-[var(--color-border)]" }, "No generated assets yet. Presentations produced inside this task's bound session are tagged ", /* @__PURE__ */ e.h("span", { className: "font-mono" }, "task:", t.id), " automatically.");
    const s = /* @__PURE__ */ new Set([`task:${t.id}`]);
    return t.name && t.name !== t.id && s.add(`task:${t.name}`), /* @__PURE__ */ e.h("div", { className: "border-t border-[var(--color-border)]" }, /* @__PURE__ */ e.h("div", { className: "px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)]/40" }, "Generated assets (", a.length, ")"), /* @__PURE__ */ e.h("div", { className: "flex gap-2 p-3 overflow-x-auto overflow-y-hidden" }, a.map((m) => /* @__PURE__ */ e.h("div", { key: m.id, className: "shrink-0", style: { width: 200 } }, /* @__PURE__ */ e.h(X, { presentation: m, hideTaskTags: s, onClick: () => l(m.id) })))));
  }
  function ee({ task: t, onOpen: a }) {
    const l = t.runs || [];
    return l.length ? /* @__PURE__ */ e.h("div", { className: "border-t border-[var(--color-border)]" }, l.map((s) => /* @__PURE__ */ e.h(
      "div",
      {
        key: s.id,
        onClick: a,
        className: "grid grid-cols-[160px_70px_60px_1fr] items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-white/[0.03] cursor-pointer",
        title: "Click to open this task's agent session"
      },
      /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-text-muted)]" }, O(s.started_at)),
      /* @__PURE__ */ e.h("span", { className: "text-[var(--color-text-muted)]" }, s.trigger),
      /* @__PURE__ */ e.h(B, { status: s.status }),
      /* @__PURE__ */ e.h("span", { className: "font-mono text-[var(--color-text-muted)] truncate" }, s.error || "")
    ))) : /* @__PURE__ */ e.h("div", { className: "px-3 py-3 text-[11px] text-[var(--color-text-muted)] italic" }, "No runs yet.");
  }
  function te() {
    const [t, a] = x([]), [l, s] = x(null), [m, p] = x({}), [C, i] = x(null), o = _(async () => {
      try {
        const v = await (await e.sdk.api.fetch(e.app.apiUrl("/tasks"))).json();
        a(v.tasks || []);
      } catch (r) {
        i(String(r));
      }
    }, []);
    k(() => {
      o();
    }, [o]), k(() => {
      const r = () => o();
      return window.addEventListener("aw-task-update", r), () => window.removeEventListener("aw-task-update", r);
    }, [o]);
    const [d, y] = x({}), u = _(async () => {
      try {
        const v = await (await e.sdk.api.fetch("/api/presentations")).json(), f = {}, g = {};
        for (const b of Array.isArray(v) ? v : []) {
          const $ = /* @__PURE__ */ new Set();
          for (const N of b.tags || [])
            typeof N == "string" && N.startsWith("task:") && $.add(N.slice(5));
          for (const N of $)
            g[N] || (g[N] = /* @__PURE__ */ new Set()), !g[N].has(b.id) && (g[N].add(b.id), (f[N] = f[N] || []).push(b));
        }
        for (const b of Object.keys(f))
          f[b].sort(($, N) => (N.created_at || 0) - ($.created_at || 0));
        y(f);
      } catch {
      }
    }, []), w = _((r) => {
      const v = d[r.id] || [], f = r.name && r.name !== r.id ? d[r.name] || [] : [];
      if (!f.length) return v;
      if (!v.length) return f;
      const g = new Set(v.map(($) => $.id)), b = [...v];
      for (const $ of f)
        g.has($.id) || b.push($);
      return b.sort(($, N) => (N.created_at || 0) - ($.created_at || 0)), b;
    }, [d]);
    k(() => {
      u();
    }, [u]), k(() => {
      const r = () => u();
      return window.addEventListener("aw-presentation-update", r), () => window.removeEventListener("aw-presentation-update", r);
    }, [u]);
    const h = R({});
    k(() => {
      const r = (v) => {
        var g;
        const f = (g = v.detail) == null ? void 0 : g.taskId;
        f && (p((b) => ({ ...b, [f]: !0 })), setTimeout(() => {
          const b = h.current[f];
          b && b.scrollIntoView && b.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60));
      };
      return window.addEventListener("aw-focus-task", r), () => window.removeEventListener("aw-focus-task", r);
    }, []);
    const n = async (r) => {
      try {
        await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r)}/run`), { method: "POST" }), o();
      } catch (v) {
        i(String(v));
      }
    }, S = async (r) => {
      if (confirm("Delete this task and its bound terminal session?"))
        try {
          await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r)}`), { method: "DELETE" }), o();
        } catch (v) {
          i(String(v));
        }
    }, T = async (r) => {
      try {
        await e.sdk.api.fetch(e.app.apiUrl(`/tasks/${encodeURIComponent(r.id)}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !r.enabled })
        }), o();
      } catch (v) {
        i(String(v));
      }
    }, M = async (r) => {
    };
    return /* @__PURE__ */ e.h("div", { className: "p-4 w-full" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ e.h("div", null, /* @__PURE__ */ e.h("h1", { className: "text-sm font-semibold text-[var(--color-text-primary)]" }, "Scheduled Tasks"), /* @__PURE__ */ e.h("p", { className: "text-[11px] text-[var(--color-text-muted)] mt-0.5" }, 'Each task fires its prompt into a single reusable CLI session named "Task: ', "<name>", '".')), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => s("new"),
        className: "px-3 py-1.5 text-xs rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25"
      },
      "+ New task"
    )), C && /* @__PURE__ */ e.h("div", { className: "mb-3 px-2 py-1.5 text-[11px] rounded bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30" }, C), t.length === 0 ? /* @__PURE__ */ e.h("div", { className: "px-3 py-12 text-center text-xs text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-border)] rounded" }, 'No tasks yet. Click "+ New task" to create one.') : /* @__PURE__ */ e.h("div", { className: "border border-[var(--color-border)] rounded overflow-hidden" }, /* @__PURE__ */ e.h("div", { className: "grid grid-cols-[minmax(160px,1fr)_90px_minmax(160px,1fr)_60px_120px_70px_140px] items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-header)] border-b border-[var(--color-border)]" }, /* @__PURE__ */ e.h("span", null, "Name"), /* @__PURE__ */ e.h("span", null, "CLI"), /* @__PURE__ */ e.h("span", null, "Schedule"), /* @__PURE__ */ e.h("span", null, "On"), /* @__PURE__ */ e.h("span", null, "Last run"), /* @__PURE__ */ e.h("span", null, "Presentation"), /* @__PURE__ */ e.h("span", { className: "text-right" }, "Actions")), t.map((r) => {
      const v = !!m[r.id], f = Y(r.schedules);
      return /* @__PURE__ */ e.h(
        "div",
        {
          key: r.id,
          ref: (g) => {
            g ? h.current[r.id] = g : delete h.current[r.id];
          },
          className: "border-b border-[var(--color-border)] last:border-b-0"
        },
        /* @__PURE__ */ e.h("div", { className: "grid grid-cols-[minmax(160px,1fr)_90px_minmax(160px,1fr)_60px_120px_70px_140px] items-center gap-2 px-3 py-2 hover:bg-white/[0.02]" }, /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => p((g) => ({ ...g, [r.id]: !v })),
            className: "flex items-center gap-1.5 text-left min-w-0"
          },
          /* @__PURE__ */ e.h("span", { className: "text-[var(--color-text-muted)] text-[10px] w-2.5" }, v ? "▼" : "▶"),
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
            title: (r.schedules || []).map(z).join(`
`) || "—"
          },
          f
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => T(r),
            className: `text-[10px] px-1.5 py-0.5 rounded ${r.enabled ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10"}`,
            title: r.enabled ? "Disable" : "Enable"
          },
          r.enabled ? "on" : "off"
        ), /* @__PURE__ */ e.h("span", { className: "text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5" }, /* @__PURE__ */ e.h(B, { status: r.last_run_status }), /* @__PURE__ */ e.h("span", { title: O(r.last_run_at) }, V(r.last_run_at))), (() => {
          const g = w(r).length;
          return /* @__PURE__ */ e.h(
            "button",
            {
              onClick: () => p((b) => ({ ...b, [r.id]: !v })),
              title: g > 0 ? `${g} presentation${g === 1 ? "" : "es"} — click to expand` : "No presentations for this task",
              disabled: g === 0,
              className: `flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${g > 0 ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 cursor-pointer" : "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"}`
            },
            /* @__PURE__ */ e.h("svg", { className: "w-3 h-3", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), /* @__PURE__ */ e.h("path", { d: "M3 9h18M9 3v18" })),
            /* @__PURE__ */ e.h("span", { className: "font-mono" }, g)
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
            onClick: () => M(),
            title: "Opening a task's bound session isn't ported yet",
            disabled: !0,
            className: "p-1 rounded hover:bg-white/10 text-amber-400 disabled:opacity-30"
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
        v && /* @__PURE__ */ e.h(e.React.Fragment, null, /* @__PURE__ */ e.h(ee, { task: r, onOpen: () => M() }), /* @__PURE__ */ e.h(Z, { task: r, presentations: w(r) }))
      );
    })), l && /* @__PURE__ */ e.h(
      Q,
      {
        task: l === "new" ? null : l,
        onClose: () => s(null),
        onSaved: () => {
          s(null), o();
        }
      }
    ));
  }
  e.registerSlot("core.nav.workspace", G), e.registerWindow("tasks.main", te);
}
export {
  ce as default,
  ce as register
};
