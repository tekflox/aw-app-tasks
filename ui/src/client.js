// Framework-free client core (same shape as aw-app-code-agent-clis's
// client.js) — talks to this app's own /tasks endpoints (routes.py).
//
//   apiUrl:    (sub) => string   e.g. sub="/tasks" -> ".../api/apps/tasks/tasks"
//   fetchImpl: (path, init) => Promise<Response>

export function createClient({ apiUrl, fetchImpl = fetch }) {
  async function listTasks() {
    const res = await fetchImpl(apiUrl('/tasks'));
    if (!res.ok) throw new Error(`GET /tasks -> ${res.status}`);
    const data = await res.json();
    return data.tasks || [];
  }

  async function runTask(taskId) {
    const res = await fetchImpl(apiUrl(`/tasks/${encodeURIComponent(taskId)}/run`), { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || `POST /tasks/${taskId}/run -> ${res.status}`);
    return data;
  }

  return { listTasks, runTask };
}
