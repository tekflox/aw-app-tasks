// The §7 client rules in ../src/ws.js — the branches that only execute when
// a session expires or a socket drops, which is exactly what nobody does on
// purpose and why the standard calls them out as untested everywhere else.
//
// Plain node + a fake WebSocket: this repo has no JS test runner and the
// shared release workflow only runs pytest, so tests/test_ui_ws_client.py
// shells out to this file to get it discovered. Run directly with:
//     node ui/test/ws.test.mjs
import { createSharedSocket } from '../src/ws.js';

const made = [];
globalThis.WebSocket = class {
  constructor(url) { this.url = url; made.push(this); }
  close(code, reason) { this.onclose?.({ code: code ?? 1006, reason }); }
  fire(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ok = true;
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) ok = false; };

// --- ref counting: two retains, one socket; closes only on the last release
let frames = [], status = [];
const s = createSharedSocket({ url: () => '/ws/updates', onFrame: f => frames.push(f), onStatus: x => status.push(x) });
const r1 = s.retain(); const r2 = s.retain();
check('one socket for two retains', made.length === 1);
made[0].fire({ type: 'tasks_init', data: { protocol: 1 } });
made[0].fire({ type: 'tasks_update', data: { task_id: 't1' } });
made[0].fire({ type: 'some_future_type', data: {} });   // unknown -> must be dropped by the app, reaches onFrame
made[0].fire({ type: 'error', data: { code: 'nope', message: 'x' } }); // handled centrally, never onFrame
check('init frame not forwarded as data', !frames.some(f => f.type === 'tasks_init'));
check('error frame handled centrally', !frames.some(f => f.type === 'error'));
check('tasks_update forwarded', frames.some(f => f.type === 'tasks_update'));
check('open status reported', status.some(x => x.state === 'open'));
r1();
check('still one socket after first release', made.length === 1);
r2();

// --- 4401 must NOT reconnect
made.length = 0; status.length = 0;
const s2 = createSharedSocket({ url: () => '/ws/updates', onFrame: () => {}, onStatus: x => status.push(x) });
s2.retain();
made[0].close(4401);
await sleep(1200);
check('4401 does not reconnect', made.length === 1);
check('4401 surfaces a fatal status', status.some(x => x.state === 'fatal' && x.code === 4401));

// --- a transient close DOES reconnect (with backoff)
made.length = 0;
const s3 = createSharedSocket({ url: () => '/ws/updates', onFrame: () => {}, onStatus: () => {} });
s3.retain();
made[0].close(1006);
check('backoff, not immediate', made.length === 1);
await sleep(1500);
check('transient close reconnects', made.length >= 2);

// --- a server protocol we cannot speak is fatal, not silent
made.length = 0; status.length = 0;
const s4 = createSharedSocket({ url: () => '/ws/updates', onFrame: () => {}, onStatus: x => status.push(x) });
s4.retain();
made[0].fire({ type: 'tasks_init', data: { protocol: 2 } });
await sleep(1200);
check('newer protocol is fatal', status.some(x => x.state === 'fatal' && x.code === 4426));
check('newer protocol does not reconnect', made.length === 1);

process.exit(ok ? 0 : 1);
