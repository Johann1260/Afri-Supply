import pytest
from database import get_db
import uuid

pytestmark = pytest.mark.asyncio

class TestAdmin:
    async def test_get_stats(self, client, admin_headers, seed_admin):
        r = await client.get("/api/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        assert "total_users" in r.json()

    async def test_get_users(self, client, admin_headers, seed_admin):
        r = await client.get("/api/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_get_revenue(self, client, admin_headers, seed_admin):
        r = await client.get("/api/admin/revenue", headers=admin_headers)
        assert r.status_code == 200

    async def test_get_pending_suppliers(self, client, admin_headers, seed_admin):
        r = await client.get("/api/admin/suppliers/pending", headers=admin_headers)
        assert r.status_code == 200

    async def test_admin_forbidden_for_buyer(self, client, auth_headers, seed_user):
        r = await client.get("/api/admin/stats", headers=auth_headers)
        assert r.status_code == 403

    async def test_approve_supplier(self, client, admin_headers, seed_admin, seed_supplier):
        r = await client.post(f"/api/admin/approve-supplier/{seed_supplier['id']}", headers=admin_headers)
        assert r.status_code == 200

    async def test_create_category(self, client, admin_headers, seed_admin):
        r = await client.post("/api/admin/categories", headers=admin_headers,
            json={"name": "Test Cat", "name_en": "Test Cat EN", "icon": "🔧"})
        assert r.status_code == 200
        db = get_db()
        await db.categories.delete_one({"name": "Test Cat"})

class TestSuppliers:
    async def test_get_suppliers(self, client):
        r = await client.get("/api/suppliers")
        assert r.status_code == 200

    async def test_get_supplier_profile(self, client, seed_supplier):
        r = await client.get(f"/api/suppliers/{seed_supplier['id']}/profile")
        assert r.status_code == 200

    async def test_get_supplier_products(self, client, seed_supplier):
        r = await client.get(f"/api/suppliers/{seed_supplier['id']}/products")
        assert r.status_code == 200

    async def test_supplier_self_stats(self, client, supplier_headers, seed_supplier):
        r = await client.get("/api/supplier/stats", headers=supplier_headers)
        assert r.status_code == 200
        assert "products_count" in r.json()

    async def test_supplier_self_products(self, client, supplier_headers, seed_supplier):
        r = await client.get("/api/supplier/products", headers=supplier_headers)
        assert r.status_code == 200

    async def test_unlock_status(self, client, auth_headers, seed_user, seed_supplier):
        r = await client.get(f"/api/contacts/{seed_supplier['id']}/unlock-status", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["unlocked"] == False

class TestRFQ:
    async def test_create_rfq(self, client, auth_headers, seed_user, seed_product):
        r = await client.post("/api/rfq", headers=auth_headers, json={
            "product_id": seed_product["id"], "quantity": 100,
            "delivery_location": "Douala, Cameroun"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "pending"
        db = get_db()
        await db.rfqs.delete_one({"id": r.json()["id"]})

    async def test_get_rfqs(self, client, auth_headers, seed_user):
        r = await client.get("/api/rfq", headers=auth_headers)
        assert r.status_code == 200

class TestCategories:
    async def test_get_categories(self, client):
        r = await client.get("/api/categories")
        assert r.status_code == 200

class TestNotifications:
    async def test_get_notifications(self, client, auth_headers, seed_user):
        r = await client.get("/api/notifications", headers=auth_headers)
        assert r.status_code == 200
        assert "items" in r.json()

    async def test_unread_count(self, client, auth_headers, seed_user):
        r = await client.get("/api/notifications/unread-count", headers=auth_headers)
        assert r.status_code == 200
        assert "unread_count" in r.json()

class TestFavorites:
    async def test_get_favorites(self, client, auth_headers, seed_user):
        r = await client.get("/api/favorites", headers=auth_headers)
        assert r.status_code == 200

    async def test_add_favorite(self, client, auth_headers, seed_user, seed_product):
        r = await client.post(f"/api/favorites/{seed_product['id']}", headers=auth_headers)
        assert r.status_code == 200
        db = get_db()
        await db.users.update_one({"id": seed_user["id"]}, {"$set": {"favorites": []}})

class TestHealth:
    async def test_health(self, client):
        r = await client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

class TestBlog:
    async def test_get_posts(self, client):
        r = await client.get("/api/blog")
        assert r.status_code == 200
        assert "posts" in r.json()