/**
 * Centralized PostgreSQL pool — WHY pooling: reuses TCP connections to Postgres
 * instead of opening one per request, which would exhaust file descriptors under load.
 */
const { Pool } = require('pg');

// Single pool instance shared across the app (singleton pattern).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Cap concurrent DB connections per container — WHY: protects Postgres from
  // connection storms if many HTTP workers exist.
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  // Log only — WHY: idle clients can emit errors; we don't crash the process;
  // health checks and request handlers report degraded state explicitly.
  console.error('Unexpected idle PostgreSQL client error', err.message);
});

module.exports = { pool };
