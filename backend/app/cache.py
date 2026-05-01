"""
Simple in-memory cache for config and log content
"""
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta
import threading


class ContentCache:
    """Thread-safe cache for file content"""
    
    def __init__(self):
        self._cache: Dict[str, Tuple[str, datetime]] = {}
        self._lock = threading.Lock()
    
    def get(self, key: str, ttl: int = 300) -> Optional[str]:
        """Get cached content if it exists and hasn't expired"""
        with self._lock:
            if key in self._cache:
                content, cached_at = self._cache[key]
                if datetime.now() - cached_at < timedelta(seconds=ttl):
                    return content
                else:
                    # Expired, remove it
                    del self._cache[key]
            return None
    
    def set(self, key: str, content: str):
        """Cache content"""
        with self._lock:
            self._cache[key] = (content, datetime.now())
    
    def invalidate(self, key: str):
        """Remove cached content"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
    
    def clear(self):
        """Clear all cached content"""
        with self._lock:
            self._cache.clear()


# Global cache instance
content_cache = ContentCache()

