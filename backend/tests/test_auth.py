import pytest
from database import get_db

pytestmark = pytest.mark.asyncio

class TestRegister:
    async def test_register_success(self, client):
        r = await client.post("/api/auth/register", json={
            "email": "new@test.com", "password": "Test1234!",
            "full_name": "New User", "user_type": "buyer"
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == "new@test.com"
        assert data["user"]["account_status"] == "pending_email"
        # Cleanup
        db = get_db()
        await db.users.delete_one({"email": "new@test.com"})

    async def test_register_duplicate(self, client, seed_user):
        r = await client.post("/api/auth/register", json={
            "email": seed_user["email"], "password": "Test1234!",
            "full_name": "Dup", "user_type": "buyer"
        })
        assert r.status_code == 400
        assert "déjà utilisé" in r.json()["detail"]

    async def test_register_invalid_email(self, client):
        r = await client.post("/api/auth/register", json={
            "email": "not-an-email", "password": "Test1234!",
            "full_name": "Bad", "user_type": "buyer"
        })
        assert r.status_code == 422

class TestLogin:
    async def test_login_success(self, client, seed_user):
        r = await client.post("/api/auth/login", json={
            "email": seed_user["email"], "password": "Test1234!"
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    async def test_login_wrong_password(self, client, seed_user):
        r = await client.post("/api/auth/login", json={
            "email": seed_user["email"], "password": "Wrong1234!"
        })
        assert r.status_code == 401

    async def test_login_nonexistent(self, client):
        r = await client.post("/api/auth/login", json={
            "email": "ghost@test.com", "password": "Test1234!"
        })
        assert r.status_code == 401

class TestMe:
    async def test_get_me(self, client, seed_user, auth_headers):
        r = await client.get("/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == seed_user["email"]

    async def test_get_me_no_token(self, client):
        r = await client.get("/api/auth/me")
        assert r.status_code == 403

    async def test_update_me(self, client, seed_user, auth_headers):
        r = await client.put("/api/auth/me", headers=auth_headers,
            json={"full_name": "Updated Name"})
        assert r.status_code == 200
        assert r.json()["full_name"] == "Updated Name"

class TestPassword:
    async def test_change_password(self, client, seed_user, auth_headers):
        r = await client.put("/api/auth/password", headers=auth_headers,
            json={"current_password": "Test1234!", "new_password": "NewPass1234!"})
        assert r.status_code == 200

    async def test_change_password_wrong_current(self, client, seed_user, auth_headers):
        r = await client.put("/api/auth/password", headers=auth_headers,
            json={"current_password": "Wrong!", "new_password": "NewPass1234!"})
        assert r.status_code == 400

    async def test_change_password_too_short(self, client, seed_user, auth_headers):
        r = await client.put("/api/auth/password", headers=auth_headers,
            json={"current_password": "Test1234!", "new_password": "123"})
        assert r.status_code == 400