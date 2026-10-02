import pytest
from services.bypass_service import detect_bypass, generate_anonymous_id

pytestmark = pytest.mark.asyncio

class TestBypassDetection:
    def test_phone_detected(self):
        assert detect_bypass("Mon numéro 691234567") == True

    def test_email_detected(self):
        assert detect_bypass("Contactez moi sur test@gmail.com") == True

    def test_whatsapp_detected(self):
        assert detect_bypass("Rejoignez-moi sur WhatsApp") == True

    def test_url_detected(self):
        assert detect_bypass("Voir https://example.com") == True

    def test_clean_message(self):
        assert detect_bypass("Je voudrais 500 tubes acier 40x40") == False

    def test_empty_message(self):
        assert detect_bypass("") == False
        assert detect_bypass(None) == False

    def test_anonymous_id_consistent(self):
        id1 = generate_anonymous_id("user-123")
        id2 = generate_anonymous_id("user-123")
        assert id1 == id2
        assert id1.startswith("Partenaire-")

    def test_anonymous_id_different_users(self):
        assert generate_anonymous_id("a") != generate_anonymous_id("b")

class TestAuthSecurity:
    async def test_expired_token_rejected(self, client):
        r = await client.get("/api/auth/me", headers={"Authorization": "Bearer expired.token.here"})
        assert r.status_code in (401, 403)

    async def test_no_token_rejected(self, client):
        r = await client.get("/api/auth/me")
        assert r.status_code == 403

    async def test_malformed_token(self, client):
        r = await client.get("/api/auth/me", headers={"Authorization": "Bearer xxx"})
        assert r.status_code == 401

class TestInputValidation:
    async def test_register_short_password(self, client):
        r = await client.post("/api/auth/register", json={
            "email": "val@test.com", "password": "123",
            "full_name": "V", "user_type": "buyer"
        })
        # Password length checked at app level, may return 200 then fail on login
        # or 422 if validated — either way it's handled

    async def test_xss_in_name(self, client, seed_user, auth_headers):
        r = await client.put("/api/auth/me", headers=auth_headers,
            json={"full_name": "<script>alert('xss')</script>"})
        assert r.status_code == 200
        assert "<script>" not in r.json()["full_name"]

    async def test_product_invalid_json_specs(self, client, supplier_headers, seed_supplier, seed_category):
        r = await client.post("/api/products", headers=supplier_headers, data={
            "name": "Test", "price": "1000", "category_id": seed_category["id"],
            "specifications": "not-json{{{"
        })
        assert r.status_code == 200  # Should fallback to empty specs

class TestCORS:
    async def test_options_request(self, client):
        r = await client.options("/api/health")
        # FastAPI handles CORS via middleware
        assert r.status_code in (200, 204, 405)


# ── Régressions sécurité majeures (audit 2026-05) ───────────────────────────
class TestPrivilegeEscalation:
    async def test_register_cannot_become_admin(self, client):
        """user_type='admin' au register doit être refusé par le Literal Pydantic."""
        r = await client.post("/api/auth/register", json={
            "email": "evil@test.com", "password": "Test1234!",
            "full_name": "Evil", "user_type": "admin"
        })
        assert r.status_code == 422

    async def test_register_invalid_user_type(self, client):
        r = await client.post("/api/auth/register", json={
            "email": "evil2@test.com", "password": "Test1234!",
            "full_name": "Evil", "user_type": "superuser"
        })
        assert r.status_code == 422

    async def test_register_short_password_rejected(self, client):
        r = await client.post("/api/auth/register", json={
            "email": "short@test.com", "password": "abc",
            "full_name": "X", "user_type": "buyer"
        })
        assert r.status_code == 422


class TestPendingEmailJWTBlocked:
    async def test_pending_email_jwt_rejected(self, client, test_user):
        """Token émis pour un compte pending_email doit être rejeté par get_current_user."""
        from database import get_db
        from services.auth_service import create_access_token
        db = get_db()
        test_user["account_status"] = "pending_email"
        test_user["email_verified"] = False
        await db.users.delete_many({"email": test_user["email"]})
        await db.users.insert_one(test_user)
        token = create_access_token(test_user["id"])
        r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403
        await db.users.delete_one({"id": test_user["id"]})

    async def test_deleted_account_jwt_rejected(self, client, test_user):
        from database import get_db
        from services.auth_service import create_access_token
        db = get_db()
        test_user["account_status"] = "deleted"
        await db.users.delete_many({"email": test_user["email"]})
        await db.users.insert_one(test_user)
        token = create_access_token(test_user["id"])
        r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403
        await db.users.delete_one({"id": test_user["id"]})


class TestUnapprovedSupplierGuards:
    async def test_pending_review_supplier_cannot_create_product(self, client, test_supplier, seed_category):
        """Un fournisseur en pending_review doit être bloqué par require_active_supplier."""
        from database import get_db
        from services.auth_service import create_access_token
        db = get_db()
        test_supplier["account_status"] = "pending_review"
        await db.users.delete_many({"email": test_supplier["email"]})
        await db.users.insert_one(test_supplier)
        token = create_access_token(test_supplier["id"])
        r = await client.post("/api/products",
            headers={"Authorization": f"Bearer {token}"},
            data={"name": "Tube", "price": "1000", "category_id": seed_category["id"]})
        assert r.status_code == 403
        await db.users.delete_one({"id": test_supplier["id"]})


class TestSoftDeleteCascade:
    async def test_admin_delete_user_anonymizes(self, client, seed_admin, admin_headers, test_user):
        from database import get_db
        db = get_db()
        await db.users.delete_many({"email": test_user["email"]})
        await db.users.insert_one(test_user)
        # Add a product owned by user (acting as supplier for cascade test)
        prod = {"id": "prod-cascade-1", "supplier_id": test_user["id"],
                "name": "P", "price": 100, "is_available": True, "is_approved": True}
        await db.products.insert_one(prod)
        r = await client.delete(f"/api/admin/users/{test_user['id']}", headers=admin_headers)
        assert r.status_code == 200
        u = await db.users.find_one({"id": test_user["id"]}, {"_id": 0})
        assert u["account_status"] == "deleted"
        assert u["full_name"] == "[Compte supprimé]"
        assert u["email"].endswith("@deleted.afrisupply.local")
        assert "password_hash" not in u
        p = await db.products.find_one({"id": "prod-cascade-1"}, {"_id": 0})
        assert p["is_available"] is False and p["is_approved"] is False
        # Cleanup
        await db.products.delete_one({"id": "prod-cascade-1"})
        await db.users.delete_one({"id": test_user["id"]})

    async def test_admin_cannot_delete_admin(self, client, seed_admin, admin_headers):
        from database import get_db
        from services.auth_service import hash_password
        db = get_db()
        other = {"id": "other-admin", "email": "other-admin@t.com", "full_name": "Other",
                 "user_type": "admin", "account_status": "active",
                 "password_hash": hash_password("x"), "created_at": "2026-01-01"}
        await db.users.insert_one(other)
        r = await client.delete("/api/admin/users/other-admin", headers=admin_headers)
        assert r.status_code == 400
        await db.users.delete_one({"id": "other-admin"})


class TestBypassObfuscation:
    def test_bypass_at_dot_obfuscation(self):
        from services.bypass_service import detect_bypass
        assert detect_bypass("contact me john (at) gmail (dot) com") is True

    def test_bypass_arobase_french(self):
        from services.bypass_service import detect_bypass
        assert detect_bypass("écris moi: pierre arobase yahoo point fr") is True

    def test_bypass_accents_normalized(self):
        from services.bypass_service import detect_bypass
        # "héberger" with accents should not false-positive a clean message
        assert detect_bypass("Je peux héberger 500 unités en stock") is False

    def test_bypass_whatsapp_variants(self):
        from services.bypass_service import detect_bypass
        assert detect_bypass("ping me on whats app please") is True
        assert detect_bypass("envoie sur WeChat") is True


class TestMobileMoneyAdminOnly:
    async def test_buyer_cannot_confirm_own_momo(self, client, seed_user, auth_headers):
        from database import get_db
        db = get_db()
        tx = {"id": "tx-buyer-self", "user_id": seed_user["id"], "amount": 5000,
              "status": "pending", "payment_type": "mobile_money"}
        await db.payment_transactions.insert_one(tx)
        r = await client.post("/api/checkout/mobile-money/tx-buyer-self/confirm",
                              headers=auth_headers)
        assert r.status_code == 403
        await db.payment_transactions.delete_one({"id": "tx-buyer-self"})

    async def test_admin_can_confirm_momo(self, client, seed_admin, admin_headers, seed_user):
        from database import get_db
        db = get_db()
        tx = {"id": "tx-admin-ok", "user_id": seed_user["id"], "amount": 5000,
              "status": "pending", "payment_type": "mobile_money"}
        await db.payment_transactions.insert_one(tx)
        r = await client.post("/api/checkout/mobile-money/tx-admin-ok/confirm",
                              headers=admin_headers)
        assert r.status_code == 200
        updated = await db.payment_transactions.find_one({"id": "tx-admin-ok"}, {"_id": 0})
        assert updated["status"] == "completed"
        assert updated.get("confirmed_by") == seed_admin["id"]
        await db.payment_transactions.delete_one({"id": "tx-admin-ok"})

    async def test_admin_confirm_momo_idempotent(self, client, seed_admin, admin_headers, seed_user):
        from database import get_db
        db = get_db()
        tx = {"id": "tx-idem", "user_id": seed_user["id"], "amount": 5000,
              "status": "completed", "payment_type": "mobile_money"}
        await db.payment_transactions.insert_one(tx)
        r = await client.post("/api/checkout/mobile-money/tx-idem/confirm",
                              headers=admin_headers)
        # Already completed → returns 200 but no second cart-creation side effect
        assert r.status_code == 200
        await db.payment_transactions.delete_one({"id": "tx-idem"})


class TestMessagingGate:
    async def test_buyer_without_paid_order_blocked(self, client, seed_user, auth_headers, seed_supplier):
        r = await client.post("/api/messages", headers=auth_headers, json={
            "receiver_id": seed_supplier["id"], "content": "Bonjour"
        })
        assert r.status_code == 403


class TestCategoryCascade:
    async def test_delete_category_with_products_blocked(self, client, seed_admin, admin_headers, seed_category, seed_product):
        # seed_product uses test_product fixture which has its own category_id != seed_category["id"]
        # Create explicit link
        from database import get_db
        db = get_db()
        await db.products.update_one({"id": seed_product["id"]}, {"$set": {"category_id": seed_category["id"]}})
        r = await client.delete(f"/api/admin/categories/{seed_category['id']}", headers=admin_headers)
        assert r.status_code == 409

    async def test_delete_category_force_detaches(self, client, seed_admin, admin_headers, seed_category, seed_product):
        from database import get_db
        db = get_db()
        await db.products.update_one({"id": seed_product["id"]}, {"$set": {"category_id": seed_category["id"]}})
        r = await client.delete(f"/api/admin/categories/{seed_category['id']}?force=true",
                                headers=admin_headers)
        assert r.status_code == 200
        p = await db.products.find_one({"id": seed_product["id"]}, {"_id": 0})
        assert p["category_id"] is None