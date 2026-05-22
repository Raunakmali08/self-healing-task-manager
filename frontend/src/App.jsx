import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

/**
 * All API calls go through `/api/*` — WHY: nginx proxies that prefix to Express in Docker,
 * so the browser stays same-origin (no CORS headaches in production compose).
 */
const API_BASE = '/api';
const PROMETHEUS_GRAPH_BASE = 'http://127.0.0.1:9090/graph';
const PROMETHEUS_QUERIES = [
  {
    title: 'Task Manager Status',
    expr: 'up{job="task-manager"}',
  },
  {
    title: 'Request Rate',
    expr: 'sum by (route, status_code) (rate(http_requests_total{job="task-manager"}[5m]))',
  },
  {
    title: 'Task List Latency (P95)',
    expr: 'histogram_quantile(0.95, sum by (le) (rate(task_fetch_duration_seconds_bucket{job="task-manager"}[5m])))',
  },
  {
    title: 'Success Rate %',
    expr: '100 * (1 - (sum(rate(http_requests_total{job="task-manager",status_code=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total{job="task-manager"}[5m])), 1e-9)))',
  },
  {
    title: 'Tasks Created Total',
    expr: 'task_creation_total{job="task-manager"}',
  },
  {
    title: 'DB Pool Size',
    expr: 'db_connection_pool_size{job="task-manager"}',
  },
  {
    title: 'DB Pool Idle',
    expr: 'db_connection_pool_idle{job="task-manager"}',
  },
];

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createStatus, setCreateStatus] = useState('pending');

  const loadTasks = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const taskCount = useMemo(() => tasks.length, [tasks]);

  async function createTask(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description,
          status: createStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTitle('');
      setDescription('');
      setCreateStatus('pending');
      await loadTasks();
    } catch (e) {
      setError(e.message || 'Create failed');
    }
  }

  async function updateTask(id, patch) {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await loadTasks();
    } catch (e) {
      setError(e.message || 'Update failed');
    }
  }

  async function deleteTask(id) {
    if (!window.confirm('Delete this task?')) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        await loadTasks();
        return;
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Task Manager</h1>
        <div className="count-pill" aria-live="polite">
          Live tasks: <strong>{loading ? '…' : taskCount}</strong>
        </div>
      </header>

      {error ? (
        <div className="banner error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="panel" aria-labelledby="new-task-heading">
        <h2 id="new-task-heading">New task</h2>
        <form className="form-grid" onSubmit={createTask}>
          <label>
            Title
            <input
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              required
              maxLength={255}
              placeholder="What needs doing?"
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              placeholder="Optional details"
            />
          </label>
          <label>
            Initial status
            <select value={createStatus} onChange={(ev) => setCreateStatus(ev.target.value)}>
              <option value="pending">pending</option>
              <option value="in-progress">in-progress</option>
              <option value="done">done</option>
            </select>
          </label>
          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={!title.trim()}>
              Add task
            </button>
            <button className="btn btn-ghost" type="button" onClick={loadTasks}>
              Refresh list
            </button>
          </div>
        </form>
      </section>

      <section className="panel" aria-labelledby="prometheus-heading">
        <div className="panel-head">
          <h2 id="prometheus-heading">Prometheus graph queries</h2>
          <a className="btn btn-ghost" href={PROMETHEUS_GRAPH_BASE} target="_blank" rel="noreferrer">
            Open Prometheus
          </a>
        </div>
        <p className="panel-copy">
          These match the PromQL used by the Grafana task manager dashboard.
        </p>
        <ul className="query-list">
          {PROMETHEUS_QUERIES.map((query) => (
            <li key={query.title} className="query-card">
              <div>
                <p className="query-title">{query.title}</p>
                <code className="query-code">{query.expr}</code>
              </div>
              <a
                className="btn btn-ghost"
                href={`${PROMETHEUS_GRAPH_BASE}?g0.expr=${encodeURIComponent(query.expr)}&g0.tab=0`}
                target="_blank"
                rel="noreferrer"
              >
                Open query
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="list-heading">
        <h2 id="list-heading">Your tasks</h2>
        {loading ? (
          <p className="empty">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="empty">No tasks yet. Add one above.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((t) => (
              <li key={t.id} className="task-card">
                <div className="task-head">
                  <p className="task-title">{t.title}</p>
                  <span className={`badge ${t.status}`}>{t.status}</span>
                </div>
                {t.description ? <p className="task-desc">{t.description}</p> : null}
                <p className="task-meta">Created: {formatDate(t.created_at)} · id #{t.id}</p>
                <div className="task-actions">
                  <select
                    aria-label={`Status for ${t.title}`}
                    value={t.status}
                    onChange={(ev) => updateTask(t.id, { status: ev.target.value })}
                  >
                    <option value="pending">pending</option>
                    <option value="in-progress">in-progress</option>
                    <option value="done">done</option>
                  </select>
                  <button type="button" className="btn btn-ghost" onClick={() => deleteTask(t.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
