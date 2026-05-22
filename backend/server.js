/**
 * Task Manager API + Prometheus metrics
 * WHY Express: minimal, widely understood, easy to containerize for demos.
 */
const express = require('express');
const cors = require('cors');
const client = require('prom-client');
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Default Node/process metrics — WHY: complements our custom business metrics.
client.collectDefaultMetrics({ prefix: 'nodejs_' });

// --- Custom metrics (names match Prometheus naming conventions) ---

/** Counts successful task creations — WHY counter: monotonically increasing signal for product activity. */
const taskCreationTotal = new client.Counter({
  name: 'task_creation_total',
  help: 'Total number of tasks successfully created',
});

/** Latency of listing tasks — WHY histogram: SLO-friendly; you can derive p95 in Prometheus. */
const taskFetchDurationSeconds = new client.Histogram({
  name: 'task_fetch_duration_seconds',
  help: 'Duration of GET /tasks database query in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

/** Reflects pg pool sizing — WHY gauge: instantaneous value, not cumulative. */
const dbConnectionPoolSize = new client.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current total clients in the PostgreSQL pool (from node-pg)',
});

const dbConnectionPoolIdle = new client.Gauge({
  name: 'db_connection_pool_idle',
  help: 'Idle clients in the PostgreSQL pool',
});

/** HTTP traffic by logical route pattern and status — WHY labels: slice error rates per endpoint. */
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['route', 'status_code'],
});

// Periodically sync pool stats into gauges — WHY: pg pool does not push metrics; we sample.
setInterval(() => {
  try {
    dbConnectionPoolSize.set(pool.totalCount);
    dbConnectionPoolIdle.set(pool.idleCount);
  } catch (_) {
    /* ignore sampling errors */
  }
}, 2000).unref();

app.use(cors());
app.use(express.json());

/**
 * WHY normalize route: keeps cardinality low (no raw URLs with IDs exploding label sets).
 */
function routeLabel(req) {
  if (req.path.startsWith('/tasks')) return '/tasks';
  if (req.path === '/health') return '/health';
  if (req.path === '/metrics') return '/metrics';
  return req.path || '/';
}

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({
      route: routeLabel(req),
      status_code: String(res.statusCode),
    });
  });
  next();
});

async function checkDb() {
  const clientConn = await pool.connect();
  try {
    await clientConn.query('SELECT 1');
    return 'ok';
  } finally {
    clientConn.release();
  }
}

// --- Health: orchestrators and load balancers use this before routing traffic ---
app.get('/health', async (req, res) => {
  let db_connection = 'error';
  try {
    db_connection = await checkDb();
  } catch (e) {
    db_connection = 'error';
  }
  const healthy = db_connection === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    db_connection,
    uptime: process.uptime(),
  });
});

// --- Prometheus scrape endpoint ---
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (e) {
    res.status(500).send(String(e.message));
  }
});

const ALLOWED_STATUS = new Set(['pending', 'in-progress', 'done']);

// --- CRUD ---

app.post('/tasks', async (req, res) => {
  const { title, description = '', status = 'pending' } = req.body || {};
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required (string)' });
  }
  if (!ALLOWED_STATUS.has(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO tasks (title, description, status)
       VALUES ($1, $2, $3)
       RETURNING id, title, description, status, created_at`,
      [title.trim(), String(description), status]
    );
    taskCreationTotal.inc();
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error('POST /tasks', e.message);
    res.status(503).json({ error: 'database unavailable', detail: e.message });
  }
});

app.get('/tasks', async (req, res) => {
  const endTimer = taskFetchDurationSeconds.startTimer();
  try {
    const r = await pool.query(
      'SELECT id, title, description, status, created_at FROM tasks ORDER BY created_at DESC'
    );
    endTimer();
    res.json(r.rows);
  } catch (e) {
    endTimer();
    console.error('GET /tasks', e.message);
    res.status(503).json({ error: 'database unavailable', detail: e.message });
  }
});

app.put('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const { title, description, status } = req.body || {};
  const fields = [];
  const values = [];
  let i = 1;
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title must be non-empty string' });
    }
    fields.push(`title = $${i++}`);
    values.push(title.trim());
  }
  if (description !== undefined) {
    fields.push(`description = $${i++}`);
    values.push(String(description));
  }
  if (status !== undefined) {
    if (!ALLOWED_STATUS.has(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    fields.push(`status = $${i++}`);
    values.push(status);
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }
  values.push(id);
  try {
    const r = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, title, description, status, created_at`,
      values
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'task not found' });
    }
    res.json(r.rows[0]);
  } catch (e) {
    console.error('PUT /tasks/:id', e.message);
    res.status(503).json({ error: 'database unavailable', detail: e.message });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'invalid id' });
  }
  try {
    const r = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'task not found' });
    }
    res.status(204).send();
  } catch (e) {
    console.error('DELETE /tasks/:id', e.message);
    res.status(503).json({ error: 'database unavailable', detail: e.message });
  }
});

// 404 JSON — WHY: clients always get JSON, not HTML error pages from Express.
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on 0.0.0.0:${PORT}`);
});
