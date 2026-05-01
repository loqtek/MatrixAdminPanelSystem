import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

import app.settings  # noqa: F401 — loads environment before other app modules

from app.database import engine, Base, SessionLocal
from app.limiter import limiter
from app.routers import auth, dashboard, users, rooms, configs, logs, background_updates, federation, statistics
from app.models import Config, Log

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize default configs and logs
def init_default_data():
    """Create default config and log entries if they don't exist"""
    db = SessionLocal()
    try:
        # Default configs
        default_configs = [
            {
                "name": "Log Config",
                "file_path": "/etc/matrix-synapse/log.yaml",
                "description": "Matrix Synapse logging configuration",
                "file_format": "yaml",
                "cache_ttl": 300
            },
            {
                "name": "Homeserver Config",
                "file_path": "/etc/matrix-synapse/homeserver.yaml",
                "description": "Matrix Synapse main configuration file",
                "file_format": "yaml",
                "cache_ttl": 300
            }
        ]
        
        for config_data in default_configs:
            existing = db.query(Config).filter(Config.file_path == config_data["file_path"]).first()
            if not existing:
                config = Config(**config_data)
                db.add(config)
        
        # Default log
        default_log = {
            "name": "Homeserver Log",
            "file_path": "/var/log/matrix-synapse/homeserver.log",
            "description": "Matrix Synapse main server log",
            "auto_reload": False,
            "reload_interval": 5,
            "default_lines": 100
        }
        
        existing_log = db.query(Log).filter(Log.file_path == default_log["file_path"]).first()
        if not existing_log:
            log = Log(**default_log)
            db.add(log)
        
        db.commit()
        print("Default configs and logs initialized")
    except Exception as e:
        print(f"Error initializing default data: {str(e)}")
        db.rollback()
    finally:
        db.close()

# Initialize default data
init_default_data()

app = FastAPI(title="Matrix Admin Panel API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware - get origins from env or use defaults
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(users.router)
app.include_router(rooms.router)
app.include_router(configs.router)
app.include_router(logs.router)
app.include_router(background_updates.router)
app.include_router(federation.router)
app.include_router(statistics.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Matrix Admin Panel API", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
