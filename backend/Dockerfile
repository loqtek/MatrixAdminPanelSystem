# Backend Dockerfile for Matrix Admin Panel System (MAPS)
# This container runs the FastAPI backend server

# Use Python 3.12 slim image for smaller size
FROM python:3.12-slim

# Set working directory inside container
WORKDIR /app

# Set environment variables
# - PYTHONUNBUFFERED: Ensures Python output is sent straight to terminal
# - PYTHONDONTWRITEBYTECODE: Prevents Python from writing .pyc files
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
# - Required for building Python packages and database drivers
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file first (for better Docker layer caching)
# This allows Docker to cache the pip install step if requirements don't change
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend application code
COPY . .

# Expose port 8000 (FastAPI default port)
# This is the port the backend API will listen on
EXPOSE 8000

# Health check to ensure the container is running properly
# Checks the /health endpoint every 30 seconds
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the FastAPI application using uvicorn
# - host 0.0.0.0: Listen on all network interfaces (required for Docker)
# - port 8000: The port we exposed above
# - app.main:app: The FastAPI app instance in app/main.py
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

