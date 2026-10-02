import json, time
from fastapi import Depends, HTTPException, Request, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from database import get_db, get_redis
from config import get_settings

settings = get_settings()
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

_USER_CACHE_TTL = 60  # secondes — invalidé explicitement sur logout/update/password

def _extract_token(request: Request,
                   credentials: Optional[HTTPAuthorizationCredentials] = None,
                   access_token: Optional[str] = None) -> Optional[str]:
    """Priorité: cookie httpOnly > Authorization header."""
    if access_token:
        return access_token
    if credentials:
        return credentials.credentials
    return None

async def _get_user_cached(user_id: str) -> Optional[dict]:
    """Lit le user depuis Redis (TTL 60s) ou MongoDB. Réduit la charge DB sur chaque requête auth."""
    r = await get_redis()
    if r:
        try:
            cached = await r.get(f"user_cache:{user_id}")
            if cached:
                return json.loads(cached)
        except Exception:
            pass
    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if user and r:
        try:
            await r.setex(f"user_cache:{user_id}", _USER_CACHE_TTL, json.dumps(user, default=str))
        except Exception:
            pass
    return user

async def invalidate_user_cache(user_id: str) -> None:
    """Invalider le cache user — appeler sur logout, changement password, mise à jour profil."""
    r = await get_redis()
    if r:
        try:
            await r.delete(f"user_cache:{user_id}")
        except Exception:
            pass

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    access_token: Optional[str] = Cookie(default=None),
):
    token = _extract_token(request, credentials, access_token)
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await _get_user_cached(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        status = user.get("account_status", "active")
        if status == "pending_email":
            raise HTTPException(status_code=403, detail="Veuillez confirmer votre email")
        if status in ("inactive", "suspended", "banned", "rejected", "deleted"):
            raise HTTPException(status_code=403, detail="Compte désactivé")
        # Invalider les tokens émis avant token_invalidated_at (logout, password change)
        invalidated_at = user.get("token_invalidated_at")
        if invalidated_at:
            token_iat = payload.get("iat", 0)
            if token_iat < invalidated_at:
                raise HTTPException(status_code=401, detail="Session expirée — reconnectez-vous")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    access_token: Optional[str] = Cookie(default=None),
):
    token = _extract_token(request, credentials, access_token)
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = await _get_user_cached(user_id)
        if not user:
            return None
        if user.get("account_status") in ("pending_email", "inactive", "suspended", "banned", "rejected", "deleted"):
            return None
        invalidated_at = user.get("token_invalidated_at")
        if invalidated_at and payload.get("iat", 0) < invalidated_at:
            return None
        return user
    except JWTError:
        return None

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins uniquement")
    return current_user

async def require_supplier(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "supplier":
        raise HTTPException(status_code=403, detail="Fournisseurs uniquement")
    return current_user

async def require_active_supplier(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "supplier":
        raise HTTPException(status_code=403, detail="Fournisseurs uniquement")
    if current_user.get("account_status") != "active":
        raise HTTPException(status_code=403, detail="Compte fournisseur non approuvé")
    return current_user
