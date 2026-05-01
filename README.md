# Matrix Admin Panel System (MAPS)

A clean and simple admin panel for Matrix Synapse that uses the Admin API for all interactions.

## Architecture

- **Backend**: FastAPI + SQLAlchemy
- **Frontend**: Next.js + React + Tailwind CSS
- **Database**: PostgreSQL (or SQLite for development)

## Features

- Authentication via Matrix Admin API
- Dashboard with server statistics and graphs
- User management (list, filter, add, edit, deactivate)
- Room management (list, filter, delete)
- Config file viewing and editing (from database-configured paths)
- Log file viewing (from database-configured paths)
- Background updates management
- Federation management
- Detailed statistics with time-based filtering

## Quick Start with Docker

The easiest way to run MAPS is using Docker Compose:

### Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- A Matrix Synapse server with admin access

### Steps

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd MAPS
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env and set:
   # - MATRIX_SERVER_URL (required)
   # - SECRET_KEY (required, generate with: openssl rand -hex 32)
   ```

3. **Start the application**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

For detailed Docker setup instructions, see [DOCKER.md](./DOCKER.md).

## Manual Setup

### Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL (optional, SQLite works for development)
- A Matrix Synapse server with admin access

### Environment Configuration

1. Create the shared `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your configuration:
   - `DATABASE_URL`: Database connection string
   - `SECRET_KEY`: Random secret key for JWT tokens
   - `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8000)
   - `CORS_ORIGINS`: Comma-separated list of allowed origins
   - `MATRIX_SERVER_URL`: Your Matrix Synapse server URL

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the server (uses .env from project root)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
# From project root
npm install

# Run the dev server (uses .env from project root)
npm run dev
```

The frontend will be available at `http://localhost:3000`

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

## Documentation

- [DOCKER.md](./DOCKER.md) - Complete Docker setup guide
- [SETUP.md](./SETUP.md) - Detailed manual setup instructions
- [FEDERATION.md](./FEDERATION.md) - Matrix federation basics and easiest setup path

## Notes

- The system stores Matrix access tokens in the database. In production, consider encrypting these.
- Room creation is typically done through Matrix clients, not the Admin API. The Admin API is used for managing existing rooms.
- Database room statistics endpoint only works with PostgreSQL, not SQLite.
