"""Log management routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Log
from app.schemas import LogCreate, LogResponse, LogUpdate
from app.auth import get_current_admin
from app.cache import content_cache
from app.path_policy import resolve_and_check_path
from app.security_errors import public_error_detail

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("", response_model=List[LogResponse])
async def get_logs(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_admin)
):
    """Get all logs"""
    logs = db.query(Log).all()
    return logs


@router.post("", response_model=LogResponse)
async def create_log(
    log: LogCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_admin)
):
    """Create a new log entry"""
    resolve_and_check_path(log.file_path)
    db_log = Log(**log.dict())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


@router.get("/{log_id}", response_model=LogResponse)
async def get_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get log by ID"""
    log = db.query(Log).filter(Log.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@router.put("/{log_id}", response_model=LogResponse)
async def update_log(
    log_id: int,
    log_update: LogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update log metadata"""
    log = db.query(Log).filter(Log.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    
    update_data = log_update.dict(exclude_none=True)
    if "file_path" in update_data:
        resolve_and_check_path(update_data["file_path"])
    for field, value in update_data.items():
        setattr(log, field, value)
    
    db.commit()
    db.refresh(log)
    
    # Invalidate cache
    content_cache.invalidate(f"log:{log_id}")
    
    return log


@router.delete("/{log_id}")
async def delete_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete a log"""
    log = db.query(Log).filter(Log.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    
    db.delete(log)
    db.commit()
    
    # Invalidate cache
    content_cache.invalidate(f"log:{log_id}")
    
    return {"message": "Log deleted"}


@router.get("/{log_id}/content")
async def get_log_content(
    log_id: int,
    lines: int = 100,
    force_refresh: bool = False,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get log file content (last N lines, cached unless force_refresh=True)"""
    log = db.query(Log).filter(Log.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    # Use default_lines if not specified
    if lines == 100:
        lines = log.default_lines

    cache_key = f"log:{log_id}:{lines}"
    
    # Check cache unless force refresh
    if not force_refresh:
        cached_content = content_cache.get(cache_key, ttl=60)  # Logs cache for 60 seconds
        if cached_content is not None:
            return {
                "content": cached_content,
                "name": log.name,
                "path": log.file_path,
                "total_lines": 0,  # We don't cache total lines
                "cached": True
            }

    try:
        file_path = resolve_and_check_path(log.file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Log file not found")

        # Read last N lines
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            all_lines = f.readlines()
            total_lines = len(all_lines)
            content_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            content = "".join(content_lines)

        # Cache the content
        content_cache.set(cache_key, content)

        return {
            "content": content,
            "name": log.name,
            "path": log.file_path,
            "total_lines": total_lines,
            "cached": False
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to read log file", e),
        )

