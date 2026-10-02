from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis
from config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

# ── DNS resolver patch (Atlas SRV) ───────────────────────────────────────────
# Évite le timeout 5s sur les routeurs FAI qui ne répondent pas aux requêtes SRV.
# Force dnspython à utiliser Google + Cloudflare avec un lifetime confortable.
if settings.mongo_url.startswith("mongodb+srv://"):
    try:
        import dns.resolver
        _r = dns.resolver.Resolver(configure=False)
        _r.nameservers = ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
        _r.lifetime = 15
        _r.timeout = 5
        dns.resolver.default_resolver = _r
        logger.info("DNS resolver patched for Atlas SRV (Google + Cloudflare)")
    except Exception as e:
        logger.warning(f"DNS resolver patch failed: {e} — using system DNS")

# MongoDB
_mongo_client: AsyncIOMotorClient | None = None
_db = None

def get_mongo_client() -> AsyncIOMotorClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(
            settings.mongo_url,
            maxPoolSize=50, minPoolSize=5,
            maxIdleTimeMS=30000,
            connectTimeoutMS=15000,
            serverSelectionTimeoutMS=15000,
            retryWrites=True,
        )
    return _mongo_client

def get_db():
    global _db
    if _db is None:
        _db = get_mongo_client()[settings.db_name]
    return _db

# Redis (with reconnect backoff to avoid log/connect storm when down)
import time
_redis: Redis | None = None
_redis_failed_at: float = 0.0
_REDIS_RETRY_AFTER = 30  # seconds

async def get_redis() -> Redis | None:
    global _redis, _redis_failed_at
    if _redis is not None:
        # Vérifier que la connexion est toujours vivante (évite stale connection crash)
        try:
            await _redis.ping()
            return _redis
        except Exception:
            _redis = None
            _redis_failed_at = time.monotonic()
            logger.warning("Redis connection lost — resetting")
    if _redis_failed_at and (time.monotonic() - _redis_failed_at) < _REDIS_RETRY_AFTER:
        return None  # backoff: skip silently until retry window
    try:
        client = Redis.from_url(settings.redis_url, decode_responses=True)
        await client.ping()
        _redis = client
        _redis_failed_at = 0.0
        logger.info("Redis connected")
        return _redis
    except Exception as e:
        _redis_failed_at = time.monotonic()
        logger.warning(f"Redis unavailable ({e}) — cache disabled, retry in {_REDIS_RETRY_AFTER}s")
        return None

async def close_connections():
    global _mongo_client, _redis
    if _mongo_client:
        _mongo_client.close()
    if _redis:
        await _redis.close()