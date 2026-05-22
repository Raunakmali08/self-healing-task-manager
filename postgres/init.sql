-- Runs automatically on first PostgreSQL container start when mounted to
-- /docker-entrypoint-initdb.d — WHY: schema is versioned with the repo and
-- applied before any app connects, avoiding manual migration steps for demos.

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    -- Constrained to three workflow states the UI and API both understand.
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in-progress', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);
