// App-local WebSocket client for this app's own /ws/updates socket.
//
// **This is a stand-in, deliberately.** The workspace's WS standard
// (aw-workspace docs/standards/app-backend-websocket-messaging.md §7) puts
// these rules in ONE shared hook in aw-workspace-ui/src/hooks/, and that hook
// is being written right now under Kanban card
// 3d65bf3b-9510-8186-b22d-f1c583cdd0f1. It did not exist when this shipped and
// this card was told not to block on it, so the rules live here instead —
// framework-free like client.js, importing nothing from aw-workspace-ui
// internals. Migrating is meant to be a one-import change: delete this file,
// import the hook, keep createTaskUpdatesChannel's `retain()` shape.
//
// The rules it implements, and why each one is here (§7):
//
//  1. Inspect event.code in onclose. 4401 (unauthorized), 4403 (forbidden)
//     and 4426 (protocol too new) are FATAL — do not reconnect. Every client
//     in this workspace hot-looped against an auth wall forever because none
//     of them read the code; that is the live defect the standard exists to
//     stop (§0.4).
//  2. Exponential backoff with jitter, capped — not the fixed setTimeout(2000)
//     copy-pasted across five call sites.
//  3. Ignore unknown `type`s. That is what makes adding a message type a
//     backwards-compatible change (§4.3).
//  4. Handle the literal type:"error" centrally (§4.4).
//
// Plus one thing the shared hook won't do for us: ref-counting. Both of this
// app's UI slots want the same stream, and neither is persistently mounted
// (core.nav.workspace renders only while the Workspace popover is open —
// WorkspaceNav.jsx mounts <AppSlot> inside `{open && ...}`; the window body
// only while the window is open). So they share ONE connection that opens on
// the first retain() and closes on the last release.

const FATAL_CLOSE_CODES = new Set([4401, 4403, 4426]);
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30000;

// The protocol integer this client understands. A server announcing a higher
// one in its *_init frame means "reload the page", not "degrade silently".
const SUPPORTED_PROTOCOL = 1;

function backoffDelay(attempt) {
  const capped = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  // Half fixed, half jitter: spreads a fleet of tabs reconnecting after a
  // workspace restart instead of stampeding on the same tick.
  return capped / 2 + Math.random() * (capped / 2);
}

/**
 * A single shared, ref-counted aw-ws/1 connection.
 *
 * @param {object}   opts
 * @param {function} opts.url       () => string — built fresh per attempt so a
 *                                  host that rewrites its base (BYOD) is picked up.
 * @param {function} opts.onFrame   (frame) => void, for known `type`s only.
 * @param {function} [opts.onStatus] ({state, code, message}) => void.
 *                                  state: 'open' | 'closed' | 'fatal'.
 * @returns {{retain: function(): function()}} retain() opens the socket if it
 *          isn't open and returns the matching release().
 */
export function createSharedSocket({ url, onFrame, onStatus = () => {} }) {
  let ws = null;
  let retryTimer = null;
  let attempt = 0;
  let refs = 0;
  let fatal = null;

  function notify(state, code, message) {
    try {
      onStatus({ state, code, message });
    } catch {
      /* a listener that throws must not take the socket down */
    }
  }

  function scheduleReconnect() {
    if (refs === 0 || fatal || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      attempt += 1;
      connect();
    }, backoffDelay(attempt));
  }

  function handleFrame(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // not an envelope — nothing to do with it
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    const data = (msg.data && typeof msg.data === 'object') ? msg.data : {};

    // Rule 4: the literal "error", not "<domain>_error", handled in one place.
    if (msg.type === 'error') {
      console.warn(`[tasks] ws error: ${data.code || 'unknown'} — ${data.message || ''}`);
      return;
    }
    // Rule: protocol is negotiated once, in the handshake frame.
    if (msg.type === 'tasks_init') {
      const protocol = Number(data.protocol);
      if (Number.isFinite(protocol) && protocol > SUPPORTED_PROTOCOL) {
        fatal = 4426;
        notify('fatal', 4426,
          `Tasks updates need a newer page — reload (server protocol ${protocol}).`);
        try { ws.close(4426, 'protocol not supported'); } catch { /* already gone */ }
        return;
      }
      notify('open', null, null);
      return;
    }
    onFrame(msg); // Rule 3: unknown types reach here and are simply dropped.
  }

  function connect() {
    if (fatal || refs === 0) return;
    let socket;
    try {
      socket = new WebSocket(url());
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;
    socket.onopen = () => { attempt = 0; };
    socket.onmessage = (event) => handleFrame(event.data);
    socket.onerror = () => { try { socket.close(); } catch { /* already gone */ } };
    socket.onclose = (event) => {
      if (ws === socket) ws = null;
      if (fatal) return; // already reported (e.g. the protocol check below closed us)
      // Rule 1. Without this branch an expired session reconnects forever
      // against a 4401 instead of telling the user they're logged out.
      if (FATAL_CLOSE_CODES.has(event.code)) {
        fatal = event.code;
        const why = event.code === 4403 ? 'not permitted'
          : event.code === 4426 ? 'reload required'
          : 'session expired';
        console.warn(`[tasks] live updates stopped (${event.code} — ${why}); not reconnecting.`);
        notify('fatal', event.code, `Live task updates stopped — ${why}.`);
        return;
      }
      notify('closed', event.code, null);
      scheduleReconnect(); // Rule 2
    };
  }

  function teardown() {
    clearTimeout(retryTimer);
    retryTimer = null;
    attempt = 0;
    if (ws) {
      const socket = ws;
      ws = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try { socket.close(); } catch { /* already gone */ }
    }
  }

  return {
    retain() {
      refs += 1;
      if (refs === 1) connect();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        refs -= 1;
        if (refs === 0) teardown();
      };
    },
  };
}
