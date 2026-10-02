import pytest
from database import get_db

pytestmark = pytest.mark.asyncio

class TestProductsList:
    async def test_get_products(self, client, seed_product):
        r = await client.get("/api/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_get_products_search(self, client, seed_product):
        r = await client.get("/api/products", params={"search": "acier"})
        assert r.status_code == 200

    async def test_get_products_filter_price(self, client, seed_product):
        r = await client.get("/api/products", params={"min_price": 1000, "max_price": 50000})
        assert r.status_code == 200

    async def test_get_popular(self, client, seed_product):
        r = await client.get("/api/products/popular")
        assert r.status_code == 200

    async def test_get_count(self, client, seed_product):
        r = await client.get("/api/products/count")
        assert r.status_code == 200
        assert "count" in r.json()

class TestProductDetail:
    async def test_get_product(self, client, seed_product):
        r = await client.get(f"/api/products/{seed_product['id']}")
        assert r.status_code == 200
        assert r.json()["name"] == seed_product["name"]

    async def test_get_product_404(self, client):
        r = await client.get("/api/products/nonexistent-id")
        assert r.status_code == 404

class TestProductCRUD:
    async def test_create_product(self, client, supplier_headers, seed_supplier, seed_category):
        r = await client.post("/api/products", headers=supplier_headers, data={
            "name": "Nouveau Produit", "description": "Test",
            "price": "5000", "unit": "pièce", "category_id": seed_category["id"],
            "min_order_quantity": "1", "stock_quantity": "10",
        })
        assert r.status_code == 200
        pid = r.json()["id"]
        db = get_db()
        await db.products.delete_one({"id": pid})

    async def test_create_product_unauthorized(self, client, auth_headers):
        r = await client.post("/api/products", headers=auth_headers, data={
            "name": "Fail", "price": "1000", "category_id": "x",
        })
        assert r.status_code == 403

    async def test_delete_product(self, client, supplier_headers, seed_product):
        r = await client.delete(f"/api/products/{seed_product['id']}", headers=supplier_headers)
        assert r.status_code == 200

    async def test_delete_product_forbidden(self, client, auth_headers, seed_product):
        r = await client.delete(f"/api/products/{seed_product['id']}", headers=auth_headers)
        assert r.status_code == 403

class TestProductSheet:
    async def test_get_sheet_pdf(self, client, seed_product):
        r = await client.get(f"/api/products/{seed_product['id']}/sheet")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"

class TestProductReviews:
    async def test_get_reviews(self, client, seed_product):
        r = await client.get(f"/api/products/{seed_product['id']}/reviews")
        assert r.status_code == 200
        assert isinstance(r.json(), list)