# Quick Setup Guide

## Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL (optional, SQLite works for development)
- A Matrix Synapse server with admin access

## Environment Setup

First, create the shared `.env` file in the project root:

```bash
# From the project root directory
cp .env.example .env

# Edit .env with your settings
# - DATABASE_URL: Database connection string
# - SECRET_KEY: Random secret key for JWT tokens
# - NEXT_PUBLIC_API_URL: Backend API URL (default: http://localhost:8000)
# - CORS_ORIGINS: Comma-separated list of allowed origins
# - MATRIX_SERVER_URL: Your Matrix Synapse server URL (e.g., https://matrix.example.com OR http://172.17.0.1:8008 on docker in some cases)
```

## Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the server (uses .env from project root)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend Setup

```bash
# From project root (or maps directory if frontend is in maps/)
npm install

# Run the dev server (uses .env from project root)
npm run dev
```

## First Login

1. Make sure `MATRIX_SERVER_URL` is set in your `.env` file
2. Open http://localhost:3000
3. Enter your Matrix admin username (e.g., `@admin:example.com`)
4. Enter your Matrix admin password
5. You'll be redirected to the dashboard

## Granting Admin Access

If you need to grant admin access to a Matrix user:

```sql
-- Connect to your Synapse database
psql -d synapse

-- Grant admin access
UPDATE users SET admin = 1 WHERE name = '@user:example.com';
```

## Adding Config and Log Files

After logging in, you can add config and log file paths through the UI:

1. Go to the **Config** tab and click "Add Config"
2. Enter a name, file path (e.g., `/etc/matrix-synapse/homeserver.yaml`), and optional description
3. Do the same for log files in the **Logs** tab

## Notes

- The system stores Matrix access tokens in the database. In production, consider encrypting these.
- Room creation is typically done through Matrix clients, not the Admin API. The Admin API is used for managing existing rooms.
- Make sure your Matrix server's Admin API is accessible from where the backend is running.

