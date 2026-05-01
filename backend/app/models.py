from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    matrix_user_id = Column(String, unique=True, index=True)
    matrix_access_token = Column(Text)  # Encrypted at rest (see matrix_token.py)
    matrix_server_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)


class Config(Base):
    __tablename__ = "configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    file_path = Column(String, nullable=False)
    description = Column(String)
    file_format = Column(String, default="text")  # text, yaml, json, etc.
    cache_ttl = Column(Integer, default=300)  # Cache TTL in seconds (default 5 minutes)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    file_path = Column(String, nullable=False)
    description = Column(String)
    auto_reload = Column(Boolean, default=False)  # Enable auto-reload
    reload_interval = Column(Integer, default=5)  # Reload interval in seconds
    default_lines = Column(Integer, default=100)  # Default number of lines to show
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


