"""Config management routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Config
from app.schemas import ConfigCreate, ConfigResponse, ConfigUpdate, ConfigContentUpdate
from app.auth import get_current_admin
from app.cache import content_cache
from app.path_policy import resolve_and_check_path
from app.security_errors import public_error_detail

router = APIRouter(prefix="/api/configs", tags=["configs"])


@router.get("", response_model=List[ConfigResponse])
async def get_configs(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_admin)
):
    """Get all configs"""
    configs = db.query(Config).all()
    return configs


@router.post("", response_model=ConfigResponse)
async def create_config(
    config: ConfigCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_admin)
):
    """Create a new config"""
    resolve_and_check_path(config.file_path)
    db_config = Config(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


@router.get("/{config_id}", response_model=ConfigResponse)
async def get_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get config by ID"""
    config = db.query(Config).filter(Config.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@router.put("/{config_id}", response_model=ConfigResponse)
async def update_config(
    config_id: int,
    config_update: ConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update config metadata"""
    config = db.query(Config).filter(Config.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    update_data = config_update.dict(exclude_none=True)
    if "file_path" in update_data:
        resolve_and_check_path(update_data["file_path"])
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    # Invalidate cache
    content_cache.invalidate(f"config:{config_id}")
    
    return config


@router.delete("/{config_id}")
async def delete_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete a config"""
    config = db.query(Config).filter(Config.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    db.delete(config)
    db.commit()
    
    # Invalidate cache
    content_cache.invalidate(f"config:{config_id}")
    
    return {"message": "Config deleted"}


@router.get("/{config_id}/content")
async def get_config_content(
    config_id: int,
    force_refresh: bool = False,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get config file content (cached unless force_refresh=True)"""
    config = db.query(Config).filter(Config.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    cache_key = f"config:{config_id}"
    
    # Check cache unless force refresh
    if not force_refresh:
        cached_content = content_cache.get(cache_key, ttl=config.cache_ttl)
        if cached_content is not None:
            return {
                "content": cached_content,
                "name": config.name,
                "path": config.file_path,
                "cached": True
            }

    try:
        file_path = resolve_and_check_path(config.file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Config file not found")
        content = file_path.read_text()
        
        # Cache the content
        content_cache.set(cache_key, content)
        
        return {
            "content": content,
            "name": config.name,
            "path": config.file_path,
            "cached": False
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to read config file", e),
        )


@router.put("/{config_id}/content")
async def update_config_content(
    config_id: int,
    content_update: ConfigContentUpdate,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update config file content"""
    config = db.query(Config).filter(Config.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    try:
        file_path = resolve_and_check_path(config.file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Config file not found")

        file_path.write_text(content_update.content)
        
        # Update cache
        cache_key = f"config:{config_id}"
        content_cache.set(cache_key, content_update.content)
        
        return {
            "message": "Config file updated successfully",
            "name": config.name,
            "path": config.file_path
        }
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied: cannot write to config file")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to update config file", e),
        )

