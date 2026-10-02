import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone
import uuid

# Mock settings before importing app
import os
os.environ.update({
    "MONGO_URL": "mongodb://localhost:27017",
    "DB_NAME": "afrisupply_test",
    "JWT_SECRET": "test-secret-key-for-testing-only-64chars-minimum-required-here!!",
    "REDIS_URL": "redis://localhost:6379/1",
    "STRIPE_API_KEY": "",
    "RESEND_API_KEY": "",
    "ENVIRONMENT": "testing",
    "FRONTEND_URL": "http://localhost:3000",
})

from main import app
from database import get_db
from services.auth_service import create_access_token, hash_password

# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.fixture
def test_user():
    uid = str(uuid.uuid4())
    return {
        "id": uid, "email": f"test_{uid[:8]}@test.com",
        "full_name": "Test User", "company_name": "Test Corp",
        "phone": "+237600000000", "country": "Cameroun", "city": "Douala",
        "user_type": "buyer", "account_status": "active",
        "email_verified": True, "favorites": [], "viewed_products": [],
        "password_hash": hash_password("Test1234!"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

@pytest.fixture
def test_supplier():
    uid = str(uuid.uuid4())
    return {
        "id": uid, "email": f"sup_{uid[:8]}@test.com",
        "full_name": "Test Supplier", "company_name": "Steel SARL",
        "phone": "+237611111111", "country": "Cameroun", "city": "Douala",
        "user_type": "supplier", "account_status": "active",
        "email_verified": True, "favorites": [],
        "password_hash": hash_password("Test1234!"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

@pytest.fixture
def test_admin():
    uid = str(uuid.uuid4())
    return {
        "id": uid, "email": f"admin_{uid[:8]}@test.com",
        "full_name": "Admin", "user_type": "admin",
        "account_status": "active", "email_verified": True,
        "password_hash": hash_password("Admin1234!"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

@pytest.fixture
def test_product(test_supplier):
    pid = str(uuid.uuid4())
    cat_id = str(uuid.uuid4())
    return {
        "id": pid, "name": "Tube acier 40x40",
        "description": "Tube acier carré", "price": 8500.0,
        "unit": "ml", "min_order_quantity": 1, "stock_quantity": 100,
        "category_id": cat_id, "supplier_id": test_supplier["id"],
        "specifications": {"Matière": "S235"}, "images": [],
        "is_available": True, "is_approved": True, "rating": 0.0, "review_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

@pytest.fixture
def test_category():
    return {
        "id": str(uuid.uuid4()), "name": "Métallurgie",
        "name_en": "Metallurgy", "icon": "⚙️",
        "description": "Acier et métaux",
    }

@pytest.fixture
def auth_headers(test_user):
    token = create_access_token(test_user["id"])
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def supplier_headers(test_supplier):
    token = create_access_token(test_supplier["id"])
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_headers(test_admin):
    token = create_access_token(test_admin["id"])
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def seed_user(test_user):
    db = get_db()
    await db.users.delete_many({"email": test_user["email"]})
    await db.users.insert_one(test_user)
    yield test_user
    await db.users.delete_one({"id": test_user["id"]})

@pytest.fixture
async def seed_supplier(test_supplier):
    db = get_db()
    await db.users.delete_many({"email": test_supplier["email"]})
    await db.users.insert_one(test_supplier)
    yield test_supplier
    await db.users.delete_one({"id": test_supplier["id"]})

@pytest.fixture
async def seed_admin(test_admin):
    db = get_db()
    await db.users.delete_many({"email": test_admin["email"]})
    await db.users.insert_one(test_admin)
    yield test_admin
    await db.users.delete_one({"id": test_admin["id"]})

@pytest.fixture
async def seed_product(test_product, seed_supplier):
    db = get_db()
    await db.products.insert_one(test_product)
    yield test_product
    await db.products.delete_one({"id": test_product["id"]})

@pytest.fixture
async def seed_category(test_category):
    db = get_db()
    await db.categories.insert_one(test_category)
    yield test_category
    await db.categories.delete_one({"id": test_category["id"]})