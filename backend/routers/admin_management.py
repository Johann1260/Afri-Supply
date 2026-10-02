from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from database import get_db
from dependencies import get_current_user
from models.admin_role import AdminCreate, AdminUpdate, AdminRole, ROLE_PERMISSIONS, has_permission
from services.admin_log_service import log_action
from services.email_service import send_email
from passlib.context import CryptContext
import uuid, secrets, string, time

router = APIRouter(prefix="/admin", tags=["admin-management"])
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Guards ─────────────────────────────────────────────────────────────────────
async def require_superadmin(u: dict = Depends(get_current_user)) -> dict:
    if u.get("user_type") != "admin":
        raise HTTPException(403, "Accès réservé aux administrateurs")
    if u.get("account_status") != "active":
        raise HTTPException(403, "Compte administrateur suspendu")
    if u.get("admin_role", "superadmin") != "superadmin":
        raise HTTPException(403, "Action réservée aux SuperAdmins")
    return u


async def require_admin_any(u: dict = Depends(get_current_user)) -> dict:
    if u.get("user_type") != "admin":
        raise HTTPException(403, "Accès réservé aux administrateurs")
    if u.get("account_status") != "active":  # M1 fix
        raise HTTPException(403, "Compte administrateur suspendu")
    return u


def require_perm(perm: str):
    """Factory: endpoint-level permission guard."""
    async def _guard(u: dict = Depends(require_admin_any)) -> dict:
        if not has_permission(u, perm):
            raise HTTPException(403, f"Permission manquante : {perm}")
        return u
    return _guard


# ══════════════════════════════════════════════════════════════════════════════
# GESTION DES COMPTES ADMIN
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admins")
async def list_admins(u: dict = Depends(require_superadmin)):
    db = get_db()
    return await db.users.find(
        {"user_type": "admin"},
        {"_id": 0, "password_hash": 0}
    ).to_list(200)


@router.post("/admins", status_code=201)
async def create_admin(data: AdminCreate, u: dict = Depends(require_superadmin)):
    db = get_db()
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(409, "Email déjà utilisé")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "full_name": data.full_name.strip(),
        "email": data.email.lower().strip(),
        "password_hash": _pwd.hash(data.password),
        "user_type": "admin",
        "admin_role": data.admin_role.value,
        "admin_permissions": ROLE_PERMISSIONS.get(data.admin_role.value, {}),
        "account_status": "active",
        "is_email_verified": True,
        "created_at": now,
        "updated_at": now,
        "created_by": u["id"],
        "token_version": 0,
    }
    await db.users.insert_one(doc)
    await log_action(u["id"], u["full_name"], "create_admin",
                     f"Création du compte admin {data.email} (rôle: {data.admin_role.value})",
                     "admin", doc["id"])
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}


@router.put("/admins/{uid}")
async def update_admin(uid: str, data: AdminUpdate, u: dict = Depends(require_superadmin)):
    db = get_db()
    target = await db.users.find_one({"id": uid, "user_type": "admin"}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Admin introuvable")
    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.full_name is not None:
        updates["full_name"] = data.full_name.strip()
    if data.admin_role is not None:
        updates["admin_role"] = data.admin_role.value
        updates["admin_permissions"] = ROLE_PERMISSIONS.get(data.admin_role.value, {})
    if data.is_active is not None:
        updates["account_status"] = "active" if data.is_active else "suspended"
    await db.users.update_one({"id": uid}, {"$set": updates})
    await log_action(u["id"], u["full_name"], "update_admin",
                     f"Modification du compte admin {target['email']}: {list(updates.keys())}",
                     "admin", uid)
    return {**target, **updates}


@router.delete("/admins/{uid}")
async def deactivate_admin(uid: str, u: dict = Depends(require_superadmin)):
    db = get_db()
    if uid == u["id"]:
        raise HTTPException(400, "Impossible de désactiver son propre compte")
    target = await db.users.find_one({"id": uid, "user_type": "admin"}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Admin introuvable")
    await db.users.update_one({"id": uid}, {"$set": {
        "account_status": "suspended",
        "token_invalidated_at": int(time.time()),  # invalide toutes les sessions
        "updated_at": datetime.now(timezone.utc).isoformat()
    }})
    await log_action(u["id"], u["full_name"], "deactivate_admin",
                     f"Désactivation du compte admin {target['email']}",
                     "admin", uid)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# ACTIONS SUR LES UTILISATEURS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/users/{uid}/suspend")
async def suspend_user(uid: str, u: dict = Depends(require_admin_any)):
    db = get_db()
    target = await db.users.find_one({"id": uid}, {"_id": 0, "email": 1, "full_name": 1, "user_type": 1})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if target.get("user_type") == "admin":
        raise HTTPException(403, "Action impossible sur un compte admin")
    await db.users.update_one({"id": uid}, {"$set": {
        "account_status": "suspended",
        "token_invalidated_at": int(time.time()),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }})
    await log_action(u["id"], u["full_name"], "suspend_user",
                     f"Suspension de {target['email']}", "user", uid)
    return {"ok": True}


@router.post("/users/{uid}/ban")
async def ban_user(uid: str, u: dict = Depends(require_admin_any)):
    db = get_db()
    target = await db.users.find_one({"id": uid}, {"_id": 0, "email": 1, "user_type": 1})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if target.get("user_type") == "admin":
        raise HTTPException(403, "Action impossible sur un compte admin")
    await db.users.update_one({"id": uid}, {"$set": {
        "account_status": "banned",
        "token_invalidated_at": int(time.time()),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }})
    await log_action(u["id"], u["full_name"], "ban_user",
                     f"Bannissement de {target['email']}", "user", uid)
    return {"ok": True}


@router.post("/users/{uid}/reactivate")
async def reactivate_user(uid: str, u: dict = Depends(require_admin_any)):
    db = get_db()
    target = await db.users.find_one({"id": uid}, {"_id": 0, "email": 1})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    await db.users.update_one({"id": uid}, {"$set": {
        "account_status": "active",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }})
    await log_action(u["id"], u["full_name"], "reactivate_user",
                     f"Réactivation de {target['email']}", "user", uid)
    return {"ok": True}


@router.post("/users/{uid}/reset-password")
async def reset_user_password(uid: str, u: dict = Depends(require_admin_any)):
    """Génère un mot de passe temporaire, l'envoie par email, invalide toutes les sessions actives."""
    db = get_db()
    target = await db.users.find_one({"id": uid}, {"_id": 0, "email": 1, "full_name": 1})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")

    alphabet = string.ascii_letters + string.digits + "!@#$%"
    tmp_pwd = "".join(secrets.choice(alphabet) for _ in range(12))

    await db.users.update_one({"id": uid}, {"$set": {
        "password_hash": _pwd.hash(tmp_pwd),
        "must_change_password": True,
        "token_invalidated_at": int(time.time()),  # A5: invalide toutes les sessions
        "updated_at": datetime.now(timezone.utc).isoformat()
    }})

    # C3: envoyer par email, ne jamais retourner en JSON
    name = target.get("full_name", "Utilisateur")
    html = f"""<p>Bonjour {name},</p>
<p>Un administrateur AfriSupply a réinitialisé votre mot de passe.</p>
<p><strong>Mot de passe temporaire :</strong> <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-size:16px">{tmp_pwd}</code></p>
<p>Connectez-vous et changez ce mot de passe immédiatement.</p>
<p>L'équipe AfriSupply</p>"""
    await send_email(target["email"], "Réinitialisation de votre mot de passe AfriSupply", html)

    await log_action(u["id"], u["full_name"], "reset_password",
                     f"Réinitialisation du mot de passe de {target['email']} — email envoyé", "user", uid)
    return {"ok": True, "message": f"Mot de passe temporaire envoyé à {target['email']}"}


# ══════════════════════════════════════════════════════════════════════════════
# JOURNAL D'ACTIVITÉ
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/logs")
async def get_admin_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin_id: str | None = None,
    action: str | None = None,
    u: dict = Depends(require_admin_any),
):
    db = get_db()
    filt: dict = {}
    if admin_id:
        filt["admin_id"] = admin_id
    if action:
        filt["action"] = action
    logs = await db.admin_logs.find(filt, {"_id": 0}) \
        .sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.admin_logs.count_documents(filt)
    return {"logs": logs, "total": total, "skip": skip, "limit": limit}


# ══════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ BADGES — M2 fix: champs corrects
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/notifications/summary")
async def notifications_summary(u: dict = Depends(require_admin_any)):
    db = get_db()
    pending_suppliers = await db.users.count_documents(
        {"user_type": "supplier", "account_status": "pending_review"}
    )
    pending_products  = await db.products.count_documents(
        {"is_approved": False, "is_available": {"$ne": False}}
    )
    open_disputes     = await db.trade_assurance.count_documents({"status": "disputed"})
    pending_momo      = await db.payment_transactions.count_documents(
        {"payment_type": "mobile_money", "status": "pending"}  # M2: payment_type, pas method
    )
    bypass_count      = await db.bypass_attempts.count_documents({})
    return {
        "suppliers": pending_suppliers,
        "products":  pending_products,
        "disputes":  open_disputes,
        "momo":      pending_momo,
        "bypass":    bypass_count,
    }
