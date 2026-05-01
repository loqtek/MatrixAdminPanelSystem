# Docker Setup Guide for Matrix Admin Panel System (MAPS)

This guide explains how to run MAPS using Docker and Docker Compose.

## Prerequisites

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)
- A **Matrix Synapse server** with admin access

## Quick Start

### 1. Clone and Navigate to Project

```bash
cd MAPS
```

### 2. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set the following required variables:

```bash
# Required: Your Matrix Synapse server URL
MATRIX_SERVER_URL=https://matrix.example.com

# Required: Secret key for JWT tokens (generate with: openssl rand -hex 32)
SECRET_KEY=your-generated-secret-key-here

# Optional: Backend API URL (default works for Docker)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional: CORS origins (default works for localhost)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 3. Build and Start Containers

```bash
# Build and start all services
docker-compose up -d

# Or build and start with logs visible
docker-compose up
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Health Check**: http://localhost:8000/health

## Container Architecture

### Services

1. **backend** (FastAPI)
   - Port: 8000
   - Handles all API requests
   - Connects to Matrix Synapse Admin API
   - Uses SQLite database by default (stored in `backend/maps.db`)

2. **frontend** (Next.js)
   - Port: 3000
   - Serves the web interface
   - Connects to backend via internal Docker network

3. **db** (PostgreSQL - Optional)
   - Only needed if using PostgreSQL instead of SQLite
   - Uncomment in `docker-compose.yml` to enable

## Configuration Options

### Using PostgreSQL Instead of SQLite

1. Uncomment the `db` service in `docker-compose.yml`
2. Update `.env`:

```bash
DATABASE_URL=postgresql://maps_user:maps_password@db:5432/maps_db
POSTGRES_USER=maps_user
POSTGRES_PASSWORD=maps_password
POSTGRES_DB=maps_db
```

3. Rebuild and restart:

```bash
docker-compose down
docker-compose up -d
```

### Accessing Config and Log Files

If your Matrix Synapse config/log files are on the host system, mount them as volumes in `docker-compose.yml`:

```yaml
backend:
  volumes:
    - ./backend/maps.db:/app/maps.db
    - /etc/matrix-synapse:/etc/matrix-synapse:ro  # Read-only mount
    - /var/log/matrix-synapse:/var/log/matrix-synapse:ro
```

### Changing Ports

To use different ports, update `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8080:8000"  # Host:Container
  frontend:
    ports:
      - "3001:3000"  # Host:Container
```

Then update `.env`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
```

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop Services

```bash
docker-compose stop
```

### Start Services

```bash
docker-compose start
```

### Restart Services

```bash
docker-compose restart
```

### Stop and Remove Containers

```bash
docker-compose down
```

### Stop and Remove Containers + Volumes

```bash
# WARNING: This will delete your database!
docker-compose down -v
```

### Rebuild After Code Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Check Container Status

```bash
docker-compose ps
```

### Execute Commands in Containers

```bash
# Backend container
docker-compose exec backend bash
docker-compose exec backend python -c "from app.database import engine; print(engine)"

# Frontend container
docker-compose exec frontend sh
```

## Troubleshooting

### Backend Won't Start

1. Check logs: `docker-compose logs backend`
2. Verify `.env` file exists and has correct values
3. Check if port 8000 is already in use: `lsof -i :8000`
4. Verify database connection string is correct

### Frontend Can't Connect to Backend

1. Check that backend is running: `docker-compose ps`
2. Verify `NEXT_PUBLIC_API_URL` in `.env` matches your setup
3. Check CORS settings in backend environment
4. View frontend logs: `docker-compose logs frontend`

### Database Issues

**SQLite:**
- Ensure `backend/maps.db` file is writable
- Check volume mount in `docker-compose.yml`

**PostgreSQL:**
- Verify database service is running: `docker-compose ps db`
- Check database credentials in `.env`
- View database logs: `docker-compose logs db`

### Permission Issues

If you encounter permission errors with mounted volumes:

```bash
# Fix ownership
sudo chown -R $USER:$USER backend/maps.db
```

### Container Health Checks Failing

Health checks may fail during initial startup. Wait 30-60 seconds for services to fully start.

To disable health checks temporarily, comment out the `healthcheck` sections in `docker-compose.yml`.

## Production Deployment

For production deployment, consider:

1. **Use PostgreSQL** instead of SQLite
2. **Set strong SECRET_KEY**: `openssl rand -hex 32`
3. **Use reverse proxy** (nginx/traefik) for SSL/TLS
4. **Set proper CORS_ORIGINS** to your domain
5. **Use Docker secrets** for sensitive data
6. **Enable resource limits** in docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Network Architecture

```
┌─────────────────┐
│   Frontend      │  Port 3000
│   (Next.js)     │
└────────┬────────┘
         │ HTTP Requests
         │ (via Docker network)
         ▼
┌─────────────────┐
│   Backend       │  Port 8000
│   (FastAPI)     │
└────────┬────────┘
         │ Admin API
         │ (via HTTP)
         ▼
┌─────────────────┐
│ Matrix Synapse  │
│   Server        │
└─────────────────┘
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Verify environment configuration
3. Check Matrix Synapse server connectivity
4. Review this documentation


