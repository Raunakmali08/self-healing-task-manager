# Self-Healing Task Manager

A self-healing task management application that automatically recovers from failures. Built with a focus on reliability and observability, it monitors its own health and restarts services when issues occur.

## Overview

This application demonstrates self-healing infrastructure patterns in a simple task management system. It has three main components working together:

- **Frontend** - A React-based web interface for creating and managing tasks
- **Backend** - A Node.js/Express API server that handles task operations
- **Database** - PostgreSQL for persistent task storage

The application monitors its own health through built-in health checks. If any service fails, Docker automatically restarts it.

---

## Key Features

- **Self-Healing**: Automatic detection and recovery from failures
- **Health Monitoring**: Built-in health check endpoints
- **Prometheus Metrics**: Observability metrics for monitoring
- **Persistent Storage**: PostgreSQL database with automatic initialization
- **Containerized**: Easy deployment with Docker Compose

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Your Browser                     │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Frontend (React Website)      Port: 80           │
│  - Displays tasks                                       │
│  - Sends requests to backend                           │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Backend (Node.js API)        Port: 3000           │
│  - Handles task operations                             │
│  - Reports health & metrics                           │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  PostgreSQL Database           Port: 5432           │
│  - Stores all tasks                                    │
└─────────────────────────────────────────────────────┘
```

### Health Monitoring

The application uses Docker health checks to monitor each service:
- Database health check: `pg_isready` runs every 5 seconds
- Backend health check: HTTP request to `/health` every 10 seconds
- Frontend health check: HTTP request to `/health` every 10 seconds

If any service fails its health check, Docker automatically restarts it.

---

## Project Structure

```
self-healing-task-manager/
├── backend/                  # Node.js API server
│   ├── Dockerfile           # Container configuration
│   ├── db.js               # PostgreSQL connection pool
│   ├── server.js           # Express API endpoints
│   └── package.json        # Dependencies
├── frontend/                # React web application
│   ├── Dockerfile          # Container configuration
│   ├── vite.config.js      # Vite build configuration
│   ├── package.json        # Dependencies
│   └── src/                # React source files
├── postgres/                # Database configuration
│   └── init.sql            # Initial schema setup
├── docker-compose.yml       # Container orchestration
├── .env.example            # Example configuration
└── README.md               # This file
```

---

## Prerequisites

Before you start, make sure you have these installed:

| Software | Version | Installation |
|----------|---------|--------------|
| [Docker](https://docs.docker.com/get-docker/) | Latest | https://docs.docker.com/get-docker/ |
| [Docker Compose](https://docs.docker.com/compose/install/) | v2 or later | https://docs.docker.com/compose/install/ |

**Check your installations:**
```bash
docker --version
docker compose version
```

---

## Quick Start

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd self-healing-task-manager
```

### Step 2: Create Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to customize your settings (see Configuration section below).

### Step 3: Create Docker Network

Create the network for inter-container communication:

```bash
docker network create monitoring
```

### Step 4: Start the Application

```bash
docker compose up -d
```

### Step 5: Verify Everything is Running

```bash
docker compose ps
```

All three services should show "healthy" status.

### Step 6: Access the Application

Open your browser and navigate to:
```
http://localhost
```

---

## Configuration

### Environment Variables

Edit the `.env` file to configure the application:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | taskuser | PostgreSQL username |
| `POSTGRES_PASSWORD` | change_me_strong_password | PostgreSQL password |
| `POSTGRES_DB` | tasks | Database name |
| `POSTGRES_PORT` | 5432 | PostgreSQL port |
| `DATABASE_URL` | postgres://taskuser:...@postgres:5432/tasks | Full connection string |
| `BACKEND_PORT` | 3000 | Backend API port |
| `PG_POOL_MAX` | 10 | Max database connections |
| `FRONTEND_PORT` | 80 | Frontend web port |

### Changing Ports

If port 80 or 5432 is already in use, update the ports in `.env`:

```env
FRONTEND_PORT=8080
POSTGRES_PORT=5433
```

---

## Usage

### Creating a Task
1. Type a task title in the input field
2. (Optional) Add a description
3. Press Enter or click "Add Task"

### Managing Task Status
Each task has one of three statuses:
- **Pending** - Task not started
- **In Progress** - Task being worked on
- **Done** - Task completed

Click the status badge to cycle through statuses.

### Deleting a Task
Click the delete button (X) on any task to remove it.

---

## Commands Reference

### Starting and Stopping

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start all services in background |
| `docker compose down` | Stop all services (keeps data) |
| `docker compose down -v` | Stop and delete all data |
| `docker compose restart` | Restart all services |

### Viewing Logs

| Command | Description |
|---------|-------------|
| `docker compose logs -f` | View all logs in real-time |
| `docker compose logs -f backend` | View backend logs only |
| `docker compose logs -f frontend` | View frontend logs only |
| `docker compose logs -f postgres` | View database logs only |

### Checking Status

| Command | Description |
|---------|-------------|
| `docker compose ps` | Show running containers |
| `docker network ls` | List Docker networks |

### Updating

```bash
docker compose pull
docker compose up -d
```

---

## API Reference

The backend exposes the following endpoints:

### Health & Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check endpoint |
| GET | `/metrics` | Prometheus metrics |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List all tasks |
| POST | `/tasks` | Create a new task |
| PUT | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |

### Task Object

```json
{
  "id": 1,
  "title": "Task title",
  "description": "Task description",
  "status": "pending",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### Status Values

- `pending` - Task not started
- `in-progress` - Task being worked on
- `done` - Task completed

### Examples

**Create a task:**
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "My task", "description": "Details here"}'
```

**List all tasks:**
```bash
curl http://localhost:3000/tasks
```

**Update task status:**
```bash
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

**Delete a task:**
```bash
curl -X DELETE http://localhost:3000/tasks/1
```

---

## Monitoring & Observability

### Prometheus Metrics

The backend exposes Prometheus metrics at `/metrics`:

| Metric | Type | Description |
|--------|------|-------------|
| `task_creation_total` | Counter | Total tasks created |
| `task_fetch_duration_seconds` | Histogram | Task listing latency |
| `db_connection_pool_size` | Gauge | Active DB connections |
| `db_connection_pool_idle` | Gauge | Idle DB connections |
| `http_requests_total` | Counter | Total HTTP requests |

### Health Checks

- Backend health: `curl http://localhost:3000/health`
- Frontend health: `curl http://localhost/health`

---

## Troubleshooting

### Port Already in Use

```
Error: port is already allocated
```

Another application is using the port. Either:
- Stop the other application
- Change the port in `.env`

### Service Shows "Unhealthy"

The service may still be starting. Wait 30 seconds and check again:

```bash
docker compose ps
docker compose logs <service-name>
```

### Database Connection Failed

1. Verify the monitoring network exists:
   ```bash
   docker network ls | grep monitoring
   ```

2. If missing, create it:
   ```bash
   docker network create monitoring
   ```

3. Restart the application:
   ```bash
   docker compose down
   docker compose up -d
   ```

### Cannot Connect to Docker

Docker daemon is not running:
- **Linux**: `sudo systemctl start docker`
- **Mac/Windows**: Start Docker Desktop

### Container Keeps Restarting

Check the logs to identify the issue:

```bash
docker compose logs <service-name>
```

Common causes:
- Invalid environment variables in `.env`
- Missing monitoring network
- Port conflicts

### Reset Everything

To start fresh (deletes all data):

```bash
docker compose down -v
docker network create monitoring
docker compose up -d
```

---

## Development

### Local Development (Without Docker)

**Backend:**
```bash
cd backend
npm install
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Database:**
Ensure PostgreSQL is running locally and update `DATABASE_URL` in `.env`.

---

## License

MIT License
