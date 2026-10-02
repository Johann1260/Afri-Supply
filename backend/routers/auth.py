from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.security import HTTPBearer
from pydantic import EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pathlib import Path
import uuid, secrets, re, html, hashlib

from database import get_db
from dependencies import get_current_user, invalidate_user_cache
from services.auth_service import verify_password, hash_password, create_access_token, create_refresh_token
from services.email_service import send_email, tpl_verify, tpl_reset, tpl_docs_received, tpl_admin_docs
from models.user import UserCreate, UserLogin, PasswordChange, UserUpdate, UserOut, TokenOut
from models.common import EmailRequest, ResetPasswordRequest
from config import get_settings
from services.storage_service import upload_document as _upload_document
from slowapi import Limiter
from slowapi.util import get_remote_address
from jose import JWTError, jwt

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, is_prod: bool) -> None:
    """Stocke les tokens JWT dans des cookies httpOnly — immunisé XSS."""
    cookie_opts = dict(httponly=True, samesite="lax", secure=is_prod)
    response.set_cookie("access_token", access_token,
                        max_age=settings.access_token_expire_minutes * 60, **cookie_opts)
    response.set_cookie("refresh_token", refresh_token,
                        max_age=settings.refresh_token_expire_days * 86400, **cookie_opts)

def sanitize(v: str, n: int = 500) -> str:
    return re.sub(r'<[^>]+>', '', html.unescape(str(v)))[:n].strip()

def _user_response(u: dict) -> UserOut:
    return UserOut(
        id=u["id"], email=u["email"], full_name=u["full_name"],
        company_name=u.get("company_name"), phone=u.get("phone"),
        country=u.get("country"), city=u.get("city"),
        user_type=u["user_type"], created_at=u["created_at"],
        account_status=u.get("account_status","active"),
        email_verified=u.get("email_verified", True)
    )

@router.post("/register", response_model=TokenOut)
@limiter.limit("10/minute")
async def register(request: Request, data: UserCreate):
    db = get_db()
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "Email déjà utilisé")
    uid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    anon_id = f"Partenaire-{hashlib.sha256(uid.encode()).hexdigest()[:6].upper()}"
    doc = {
        "id": uid, "email": data.email,
        "anonymous_id": anon_id,
        "full_name": sanitize(data.full_name),
        "company_name": sanitize(data.company_name) if data.company_name else None,
        "phone": data.phone, "country": data.country, "city": data.city,
        "user_type": data.user_type,
        "password_hash": hash_password(data.password),
        "created_at": now, "favorites": [], "viewed_products": [],
        "email_verification_token": token,
        "email_verification_expires": expires,
        "email_verified": False, "account_status": "pending_email",
    }
    await db.users.insert_one(doc)
    link = f"{settings.frontend_url}/verify-email?token={token}"
    await send_email(data.email, "Confirmez votre email AfriSupply", tpl_verify(data.full_name, link))
    access  = create_access_token(uid)
    refresh = create_refresh_token(uid)
    response = Response()
    _set_auth_cookies(response, access, refresh, settings.is_prod)
    from fastapi.responses import JSONResponse
    token_data = {"access_token": access, "refresh_token": refresh,
                  "token_type": "bearer", "user": _user_response(doc).model_dump()}
    return JSONResponse(content=token_data, headers=dict(response.headers))

@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
async def login(request: Request, creds: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": creds.email}, {"_id": 0})
    if not user or not verify_password(creds.password, user.get("password_hash","")):
        raise HTTPException(401, "Email ou mot de passe invalide")
    status = user.get("account_status","active")
    if status == "pending_email":
        raise HTTPException(403, "Veuillez confirmer votre email.")
    if user.get("user_type") == "supplier" and status == "pending_review":
        raise HTTPException(403, "Compte en cours de vérification (48h).")
    if status in ("inactive","suspended","banned","rejected"):
        raise HTTPException(403, "Compte désactivé.")
    access  = create_access_token(user["id"])
    refresh = create_refresh_token(user["id"])
    resp_obj = Response()
    _set_auth_cookies(resp_obj, access, refresh, settings.is_prod)
    from fastapi.responses import JSONResponse
    data = {"access_token": access, "refresh_token": refresh,
            "token_type": "bearer", "user": _user_response(user).model_dump()}
    if user.get("must_change_password"):
        data["must_change_password"] = True
    return JSONResponse(content=data, headers=dict(resp_obj.headers))

from pydantic import BaseModel as _BM

class _RefreshIn(_BM):
    refresh_token: str

@router.post("/refresh")
async def refresh(body: _RefreshIn):
    from database import get_redis
    try:
        payload = jwt.decode(body.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        uid = payload.get("sub")
        jti = payload.get("jti")
        if not uid or payload.get("type") != "refresh":
            raise HTTPException(401, "Token invalide")
    except JWTError:
        raise HTTPException(401, "Token expiré")
    db = get_db()
    user = await db.users.find_one({"id": uid}, {"_id": 0, "token_invalidated_at": 1})
    if not user:
        raise HTTPException(401, "Utilisateur introuvable")
    # Vérifier invalidation globale (logout)
    inv = user.get("token_invalidated_at", 0)
    if payload.get("iat", 0) < inv:
        raise HTTPException(401, "Session expirée — reconnectez-vous")
    # Vérifier replay attack via Redis JTI blacklist
    r = await get_redis()
    if r and jti:
        if await r.get(f"revoked_jti:{jti}"):
            raise HTTPException(401, "Token déjà utilisé")
        exp_remaining = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
        await r.setex(f"revoked_jti:{jti}", max(exp_remaining, 1), "1")
    new_access  = create_access_token(uid)
    new_refresh = create_refresh_token(uid)
    resp_obj = Response()
    _set_auth_cookies(resp_obj, new_access, new_refresh, settings.is_prod)
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"},
        headers=dict(resp_obj.headers)
    )

@router.post("/logout")
async def logout(u: dict = Depends(get_current_user)):
    """Invalide tous les tokens + efface les cookies httpOnly."""
    db = get_db()
    now_ts = int(datetime.now(timezone.utc).timestamp())
    await db.users.update_one({"id": u["id"]}, {"$set": {"token_invalidated_at": now_ts}})
    await invalidate_user_cache(u["id"])
    from fastapi.responses import JSONResponse
    resp = JSONResponse(content={"message": "Déconnecté"})
    resp.delete_cookie("access_token")
    resp.delete_cookie("refresh_token")
    return resp

@router.get("/me", response_model=UserOut)
async def get_me(u: dict = Depends(get_current_user)):
    return _user_response(u)

@router.put("/me", response_model=UserOut)
async def update_me(data: UserUpdate, u: dict = Depends(get_current_user)):
    update = {k: sanitize(str(v)) for k, v in data.model_dump(exclude_none=True).items()}
    if not update: raise HTTPException(400, "Aucun champ valide")
    db = get_db()
    await db.users.update_one({"id": u["id"]}, {"$set": update})
    await invalidate_user_cache(u["id"])
    return _user_response({**u, **update})

@router.put("/password")
async def change_password(data: PasswordChange, u: dict = Depends(get_current_user)):
    if len(data.new_password) < 8: raise HTTPException(400, "Min 8 caractères")
    db = get_db()
    full = await db.users.find_one({"id": u["id"]}, {"_id": 0})
    if not verify_password(data.current_password, full.get("password_hash","")):
        raise HTTPException(400, "Mot de passe actuel incorrect")
    now_ts = int(datetime.now(timezone.utc).timestamp())
    await db.users.update_one({"id": u["id"]}, {"$set": {
        "password_hash": hash_password(data.new_password),
        "token_invalidated_at": now_ts,
    }})
    await invalidate_user_cache(u["id"])
    return {"message": "Mot de passe modifié"}

@router.get("/verify-email")
async def verify_email(token: str):
    db = get_db()
    user = await db.users.find_one({"email_verification_token": token}, {"_id": 0})
    if not user: raise HTTPException(400, "Lien invalide ou expiré")
    exp = user.get("email_verification_expires")
    if exp and datetime.fromisoformat(exp) < datetime.now(timezone.utc):
        raise HTTPException(400, "Lien expiré")
    is_supplier = user.get("user_type") == "supplier"
    new_status = "pending_review" if is_supplier else "active"
    await db.users.update_one({"id": user["id"]}, {
        "$set": {"email_verified": True, "account_status": new_status},
        "$unset": {"email_verification_token": "", "email_verification_expires": ""}
    })
    return {"message": "Email vérifié"}

@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, data: EmailRequest):
    db = get_db()
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user and not user.get("email_verified"):
        token = secrets.token_urlsafe(32)
        expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        await db.users.update_one({"email": email}, {"$set": {"email_verification_token": token, "email_verification_expires": expires}})
        link = f"{settings.frontend_url}/verify-email?token={token}"
        await send_email(email, "Confirmez votre email AfriSupply", tpl_verify(user.get("full_name",""), link))
    return {"message": "Si l'email existe, un lien a été envoyé."}

@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: EmailRequest):
    db = get_db()
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        raw_token = secrets.token_urlsafe(32)
        hashed_token = hashlib.sha256(raw_token.encode()).hexdigest()
        expires = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        await db.users.update_one({"email": email}, {"$set": {
            "password_reset_token": hashed_token,
            "password_reset_expires": expires
        }})
        link = f"{settings.frontend_url}/reset-password?token={raw_token}"
        await send_email(email, "Réinitialisation mot de passe AfriSupply", tpl_reset(link))
    return {"message": "Si l'email existe, un lien a été envoyé."}

@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, data: ResetPasswordRequest):
    db = get_db()
    raw_token = data.token; pwd = data.password
    if len(pwd) < 8: raise HTTPException(400, "Min 8 caractères")
    hashed_token = hashlib.sha256(raw_token.encode()).hexdigest()
    user = await db.users.find_one({"password_reset_token": hashed_token}, {"_id": 0})
    if not user: raise HTTPException(400, "Token invalide")
    exp = user.get("password_reset_expires")
    if exp and datetime.fromisoformat(exp) < datetime.now(timezone.utc):
        raise HTTPException(400, "Token expiré")
    await db.users.update_one({"id": user["id"]}, {
        "$set": {
            "password_hash": hash_password(pwd),
            "token_invalidated_at": int(datetime.now(timezone.utc).timestamp()),
        },
        "$unset": {"password_reset_token": "", "password_reset_expires": ""}
    })
    await invalidate_user_cache(user["id"])
    return {"message": "Mot de passe réinitialisé"}

@router.post("/documents/{user_id}")
@limiter.limit("5/minute")
async def upload_documents(request: Request, user_id: str, documents: List[UploadFile] = File(...), u: dict = Depends(get_current_user)):
    if u["id"] != user_id: raise HTTPException(403, "Accès refusé")
    if len(documents) > 10: raise HTTPException(400, "Max 10 documents")
    allowed = {"application/pdf","image/jpeg","image/png","image/jpg"}
    paths = []
    for doc in documents:
        if doc.content_type not in allowed: raise HTTPException(400, f"Type non autorisé: {doc.content_type}")
        content = await doc.read()
        if len(content) > 10*1024*1024: raise HTTPException(400, f"{doc.filename} > 10Mo")
        ext = Path(doc.filename or "doc.pdf").suffix.lower()
        if ext not in [".pdf",".jpg",".jpeg",".png"]: ext = ".pdf"
        fname = f"{user_id}_{uuid.uuid4()}{ext}"
        try:
            url = await _upload_document(content, fname)
        except ValueError as e:
            raise HTTPException(400, str(e))
        paths.append(url)
    db = get_db()
    await db.users.update_one({"id": user_id}, {"$set": {
        "company_documents": paths, "account_status": "pending_review",
        "documents_submitted_at": datetime.now(timezone.utc).isoformat()
    }})
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    await send_email(user.get("email",""), "Documents reçus — AfriSupply", tpl_docs_received(user.get("full_name",""), len(paths)))
    await send_email(settings.admin_email, f"Nouveau fournisseur — {user.get('company_name','N/A')}", tpl_admin_docs(user.get("company_name","N/A"), user.get("email",""), len(paths)))
    return {"message": "Documents soumis", "count": len(paths)}

# ── Secure Email Change ─────────────────────────────────────────────────────
from models.otp import EmailChangeRequest
from services.otp_service import send_otp, verify_otp

@router.post("/change-email/initiate")
@limiter.limit("3/minute")
async def initiate_email_change(request: Request, u: dict = Depends(get_current_user)):
    """Step 1: Send OTP to current email for verification."""
    result = await send_otp(u["id"], "change_email", "email", u["email"])
    return {"message": "Code envoyé à votre email actuel", "expires_in": result["expires_in"]}

@router.post("/change-email/confirm")
@limiter.limit("5/minute")
async def confirm_email_change(request: Request, data: EmailChangeRequest, u: dict = Depends(get_current_user)):
    """Step 2: Verify OTP from old email + schedule new email activation (24h delay)."""
    # Verify OTP against old email
    valid = await verify_otp(u["id"], "change_email", data.otp_code)
    if not valid:
        raise HTTPException(400, "Code invalide ou expiré")
    # Check new email not taken
    db = get_db()
    if await db.users.find_one({"email": data.new_email}):
        raise HTTPException(400, "Cet email est déjà utilisé")
    # Schedule activation in 24h
    activation_time = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    token = secrets.token_urlsafe(32)
    await db.users.update_one({"id": u["id"]}, {"$set": {
        "pending_email": data.new_email,
        "email_change_token": token,
        "email_change_at": activation_time,
    }})
    # Notify old email
    await send_email(u["email"], "Changement d'email programmé — AfriSupply",
        f'<div style="font-family:sans-serif;padding:32px"><h2>Changement d\'email</h2>'
        f'<p>Votre email sera changé pour <b>{data.new_email}</b> dans 24 heures.</p>'
        f'<p>Si vous n\'êtes pas à l\'origine de cette demande, changez immédiatement votre mot de passe.</p>'
        f'<a href="{settings.frontend_url}/change-password" style="background:#FF6A00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none">Changer mon mot de passe</a></div>')
    # Send confirmation link to new email
    link = f"{settings.frontend_url}/confirm-email-change?token={token}"
    await send_email(data.new_email, "Confirmez votre nouvel email — AfriSupply",
        f'<div style="font-family:sans-serif;padding:32px"><h2>Confirmer le changement</h2>'
        f'<p>Cliquez pour confirmer ce nouvel email (activation dans 24h) :</p>'
        f'<a href="{link}" style="background:#FF6A00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none">Confirmer</a></div>')
    return {"message": "Changement programmé. Confirmation envoyée aux deux adresses.", "activation_at": activation_time}

@router.get("/change-email/activate")
async def activate_email_change(token: str):
    """Step 3: Activate new email after 24h delay."""
    db = get_db()
    user = await db.users.find_one({"email_change_token": token}, {"_id": 0})
    if not user:
        raise HTTPException(400, "Lien invalide ou expiré")
    activation = user.get("email_change_at")
    if activation and datetime.fromisoformat(activation) > datetime.now(timezone.utc):
        remaining = (datetime.fromisoformat(activation) - datetime.now(timezone.utc)).total_seconds()
        raise HTTPException(400, f"Activation dans {int(remaining // 3600)}h{int((remaining % 3600) // 60)}min")
    new_email = user.get("pending_email")
    if not new_email:
        raise HTTPException(400, "Aucun changement en attente")
    await db.users.update_one({"id": user["id"]}, {
        "$set": {"email": new_email},
        "$unset": {"pending_email": "", "email_change_token": "", "email_change_at": ""}
    })
    return {"message": f"Email changé avec succès pour {new_email}"}
