import json
from typing import Any, Optional
from database import get_redis
import logging

logger = logging.getLogger(__name__)

CACHE_TTL = {
    "categories": 3600,       # 1h   — quasi-static
    "popular_products": 300,  # 5min
    "product": 120,           # 2min
    "product_list": 30,       # 30s  — hot listing, short TTL for freshness
    "supplier": 60,           # 1min
    "supplier_list": 30,      # 30s
    "supplier_stats": 60,     # 1min
    "count": 120,             # 2min — count queries are expensive at scale
}

async def cache_get(key: str) -> Optional[Any]:
    try:
        r = await get_redis()
        if not r: return None
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception as e:
        logger.debug(f"cache_get error: {e}")
        return None

async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    try:
        r = await get_redis()
        if not r: return
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.debug(f"cache_set error: {e}")

async def cache_del(*keys: str) -> None:
    try:
        r = await get_redis()
        if r and keys:
            await r.delete(*keys)
    except Exception as e:
        logger.debug(f"cache_del error: {e}")

async def cache_del_pattern(pattern: str) -> None:
    """SCAN-based deletion — non-blocking unlike KEYS. Safe at any scale."""
    try:
        r = await get_redis()
        if not r: return
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor, match=pattern, count=100)
            if keys:
                await r.delete(*keys)
            if cursor == 0:
                break
    except Exception as e:
        logger.debug(f"cache_del_pattern error: {e}")
