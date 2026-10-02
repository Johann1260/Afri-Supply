from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
import logging, uvicorn

from config import get_settings
from database import get_db, get_redis, close_connections
from middleware.security import SecurityHeadersMiddleware
from routers import auth, products, orders, cart, payments, rfq, messages, notifications, suppliers, admin, blog, categories, favorites, websocket, reviews, otp
from routers import quotations, admin_management

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()

# ── Sentry (observabilité production) ────────────────────────────────────────
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.pymongo import PyMongoIntegration

def _init_sentry():
    dsn = get_settings().sentry_dsn
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=get_settings().environment,
        integrations=[FastApiIntegration(), PyMongoIntegration()],
        traces_sample_rate=0.2,
        profiles_sample_rate=0.1,
        send_default_pii=False,   # RGPD — pas de données personnelles
        _experiments={"continuous_profiling_auto_start": False},
    )
    logger.info("Sentry initialized")

_init_sentry()




# ── APScheduler — tâches récurrentes ─────────────────────────────────────────
from apscheduler.schedulers.asyncio import AsyncIOScheduler

_scheduler: AsyncIOScheduler | None = None

async def _release_expired_escrows_job():
    """Libère automatiquement les escrows expirés toutes les 6h."""
    try:
        from routers.payments import release_expired_escrows
        result = await release_expired_escrows(_={"id": "scheduler", "full_name": "AutoScheduler"})
        if result.get("count", 0) > 0:
            logger.info(f"Scheduler: {result['count']} escrow(s) libéré(s)")
    except Exception as e:
        logger.error(f"Scheduler escrow release error: {e}")

async def _create_indexes(db):
    """Crée tous les index Mongo. Appelé via wait_for + tolérant aux échecs en dev."""
    await db.users.create_index([("email", 1)], unique=True)
    await db.users.create_index([("user_type", 1), ("account_status", 1)])
    await db.users.create_index([("id", 1)], unique=True)
    await db.products.create_index([("id", 1)], unique=True)
    await db.products.create_index([("supplier_id", 1)])
    await db.products.create_index([("category_id", 1)])
    await db.products.create_index([("is_approved", 1), ("is_available", 1), ("created_at", -1)])
    await db.products.create_index([("is_approved", 1), ("is_available", 1), ("rating", -1)])
    await db.products.create_index([("is_approved", 1), ("is_available", 1), ("category_id", 1), ("created_at", -1)])
    await db.products.create_index([("supplier_id", 1), ("is_approved", 1), ("is_available", 1)])
    await db.products.create_index([("name", "text"), ("description", "text")])
    await db.orders.create_index([("id", 1)], unique=True)
    await db.orders.create_index([("buyer_id", 1), ("created_at", -1)])
    await db.orders.create_index([("supplier_id", 1), ("created_at", -1)])
    await db.orders.create_index([("supplier_id", 1), ("status", 1), ("payment_status", 1)])
    await db.orders.create_index([("payment_status", 1)])
    await db.messages.create_index([("sender_id", 1), ("receiver_id", 1), ("created_at", -1)])
    await db.messages.create_index([("receiver_id", 1), ("is_read", 1)])
    await db.rfqs.create_index([("buyer_id", 1), ("created_at", -1)])
    await db.rfqs.create_index([("supplier_id", 1), ("status", 1)])
    await db.notifications.create_index([("user_id", 1), ("is_read", 1), ("created_at", -1)])
    await db.carts.create_index([("user_id", 1)], unique=True)
    await db.reviews.create_index([("supplier_id", 1), ("buyer_id", 1)])
    await db.reviews.create_index([("supplier_id", 1), ("created_at", -1)])
    await db.payment_transactions.create_index([("session_id", 1)], sparse=True)
    await db.payment_transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.email_verification_tokens.create_index([("created_at", 1)], expireAfterSeconds=86400)
    await db.bypass_attempts.create_index([("created_at", -1)])
    await db.storefronts.create_index([("supplier_id", 1)], unique=True)
    await db.storefronts.create_index([("slug", 1)], unique=True, sparse=True)
    await db.trade_assurance.create_index([("order_id", 1)], unique=True)
    await db.trade_assurance.create_index([("buyer_id", 1), ("status", 1)])
    await db.trade_assurance.create_index([("supplier_id", 1), ("status", 1)])
    await db.disputes.create_index([("ta_id", 1)])
    await db.otp_codes.create_index([("expires_at", 1)], expireAfterSeconds=0)
    await db.quotations.create_index([("rfq_id", 1), ("status", 1)])
    await db.quotations.create_index([("supplier_id", 1), ("created_at", -1)])
    await db.quotations.create_index([("id", 1)], unique=True)
    await db.rfqs.create_index([("rfq_type", 1), ("status", 1), ("created_at", -1)])
    await db.actualites.create_index([("is_published", 1), ("created_at", -1)])
    await db.actualites.create_index([("slug", 1)], unique=True, sparse=True)
    await db.order_tracking.create_index([("order_id", 1), ("created_at", 1)])
    await db.payment_transactions.create_index([("user_id", 1), ("status", 1), ("created_at", -1)])
    await db.payment_transactions.create_index([("user_id", 1), ("payment_type", 1), ("status", 1)])  # idempotency MoMo
    await db.rfqs.create_index([("buyer_id", 1), ("rfq_type", 1), ("status", 1), ("created_at", -1)])
    await db.admin_logs.create_index([("admin_id", 1), ("created_at", -1)])
    await db.admin_logs.create_index([("action", 1), ("created_at", -1)])
    await db.admin_logs.create_index([("created_at", -1)])
    await db.admin_logs.create_index([("created_at", 1)], expireAfterSeconds=31536000)  # TTL 1 an
    # Supplier full-text search (company_name)
    await db.users.create_index([("company_name", "text")], default_language="french", sparse=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    # ── Startup ──
    db = get_db()
    try:
        await asyncio.wait_for(_create_indexes(db), timeout=10)
        logger.info("MongoDB indexes ready")
    except Exception as e:
        # En dev: on continue même si Mongo est injoignable (DNS timeout, Atlas paused, etc.)
        # En prod: on relève l'exception pour faire échouer le boot.
        if settings.is_prod:
            raise
        logger.warning(f"MongoDB indexing skipped ({type(e).__name__}: {e}) — API boots in degraded mode")
    try:
        await asyncio.wait_for(get_redis(), timeout=3)
    except Exception as e:
        logger.warning(f"Redis init failed at startup ({e}) — backoff handles retries")
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone="Africa/Douala")
    _scheduler.add_job(_release_expired_escrows_job, "interval", hours=6, id="release_escrows")
    _scheduler.start()
    logger.info("APScheduler started (escrow release every 6h)")
    logger.info(f"AfriSupply API v2.0 ready ({settings.environment})")
    yield
    # ── Shutdown ──
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    await close_connections()


limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app = FastAPI(title="AfriSupply API", version="2.0.0",
    docs_url="/docs" if not settings.is_prod else None,
    redoc_url="/redoc" if not settings.is_prod else None,
    lifespan=lifespan,
)

# Rate limit handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middlewares
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET","POST","PUT","DELETE","OPTIONS","PATCH"],
    allow_headers=["Authorization","Content-Type","X-Requested-With","Accept-Language"],
    expose_headers=["X-RateLimit-Limit","X-RateLimit-Remaining"],
    max_age=600,
)

# Static files
for d in ["uploads/products","uploads/documents","uploads/blog"]:
    Path(d).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers — all prefixed with /api to match frontend
PREFIX = "/api"
app.include_router(auth.router,          prefix=PREFIX)
app.include_router(products.router,      prefix=PREFIX)
app.include_router(orders.router,        prefix=PREFIX)
app.include_router(cart.router,          prefix=PREFIX)
app.include_router(payments.router,      prefix=PREFIX)
app.include_router(rfq.router,           prefix=PREFIX)
app.include_router(messages.router,      prefix=PREFIX)
app.include_router(notifications.router, prefix=PREFIX)
app.include_router(suppliers.router,     prefix=PREFIX)  # no prefix in router itself
app.include_router(admin.router,         prefix=PREFIX)
app.include_router(blog.router,          prefix=PREFIX)
app.include_router(categories.router,    prefix=PREFIX)
app.include_router(favorites.router,     prefix=PREFIX)
app.include_router(reviews.router,       prefix=PREFIX)
app.include_router(otp.router,           prefix=PREFIX)
app.include_router(quotations.router,    prefix=PREFIX)
app.include_router(admin_management.router, prefix=PREFIX)
app.include_router(websocket.router)

# ── Health check — requis pour load balancer / K8s / monitoring ─────────────
@app.get("/health", tags=["system"])
async def health():
    from database import get_redis
    db_ok, redis_ok = True, False
    try:
        await get_db().command("ping")
    except Exception:
        db_ok = False
    try:
        r = await get_redis()
        if r: await r.ping(); redis_ok = True
    except Exception:
        pass
    status = "ok" if db_ok else "degraded"
    return {"status": status, "db": db_ok, "cache": redis_ok}

# ── Seed endpoint (dev only) ─────────────────────────────────────────────────
@app.post(f"{PREFIX}/seed")
async def seed_endpoint():
    if settings.is_prod:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Interdit en production")
    from seed import run_seed
    return await run_seed()
