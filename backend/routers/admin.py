from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from datetime import datetime, timezone
from pathlib import Path
import asyncio
from database import get_db
from dependencies import require_admin
from services.email_service import send_email, tpl_approved, tpl_rejected
from services.cache_service import cache_del_pattern
from config import get_settings
from models.common import CategoryCreate, SupplierRating
from models.actualite import ActualiteCreate, ActualiteUpdate, ActualiteOut, MediaItem
import uuid, re
from services.admin_log_service import log_action
from services.bypass_service import generate_anonymous_id
from services.badge_service import ADMIN_ASSIGNABLE_BADGES
from models.admin_role import has_permission

MEDIA_DIR = Path("uploads/blog")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_MEDIA = {
    "image/jpeg": "image", "image/png": "image", "image/gif": "image",
    "image/webp": "image", "video/mp4": "video", "video/webm": "video",
    "video/quicktime": "video", "application/pdf": "document",
    "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
}

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()

@router.get("/users")
async def get_users(u: dict = Depends(require_admin), skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), user_type: str = None, account_status: str = None):
    db = get_db()
    filt = {}
    if user_type: filt["user_type"] = user_type
    if account_status: filt["account_status"] = account_status
    _safe_proj = {"_id": 0, "password_hash": 0, "email_verification_token": 0,
                   "password_reset_token": 0, "email_change_token": 0}
    users = await db.users.find(filt, _safe_proj).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for u in users:
        u["anonymous_id"] = generate_anonymous_id(u["id"])
    return users

@router.get("/stats")
async def get_stats(u: dict = Depends(require_admin)):
    db = get_db()
    # Aggregation MongoDB — évite de charger 10K users en mémoire Python
    user_counts = await db.users.aggregate([
        {"$group": {"_id": {"type": "$user_type", "status": "$account_status"}, "count": {"$sum": 1}}}
    ]).to_list(50)
    def _uc(type_=None, status=None):
        return sum(c["count"] for c in user_counts
                   if (type_ is None or c["_id"]["type"] == type_)
                   and (status is None or c["_id"]["status"] == status))
    total_revenue_pipeline = [{"$match": {"payment_status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$total"}}}]
    rev = await db.orders.aggregate(total_revenue_pipeline).to_list(1)
    bypass_count = await db.bypass_attempts.count_documents({})
    active_rfqs = await db.rfqs.count_documents({"status": {"$in": ["pending", "quoted"]}})

    # Recent activity (last 8 events)
    recent_orders = await db.orders.find({}, {"_id": 0, "order_number": 1, "status": 1, "total": 1, "created_at": 1, "buyer_name": 1}).sort("created_at", -1).limit(8).to_list(8)
    recent_activity = [{"type": "order", "title": f"Commande {o.get('order_number','')}", "description": f"{o.get('status','')} — {o.get('total',0):,.0f} XAF", "time": o.get("created_at","")} for o in recent_orders]

    return {
        "total_users": _uc(),
        "total_buyers": _uc(type_="buyer"),
        "total_suppliers": _uc(type_="supplier"),
        "active_suppliers": _uc(type_="supplier", status="active"),
        "pending_suppliers": _uc(status="pending_review"),
        **dict(zip(
            ("total_orders", "total_products", "total_categories"),
            await asyncio.gather(
                db.orders.count_documents({}),
                db.products.count_documents({}),
                db.categories.count_documents({}),
            )
        )),
        "total_revenue": rev[0]["total"] if rev else 0,
        "revenue": rev[0]["total"] if rev else 0,
        "bypass_attempts": bypass_count,
        "active_rfqs": active_rfqs,
        "recent_activity": recent_activity,
    }

@router.get("/revenue")
async def get_revenue(u: dict = Depends(require_admin)):
    db = get_db()
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 7]}, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    return [doc async for doc in db.orders.aggregate(pipeline)]

@router.get("/orders")
async def get_orders(u: dict = Depends(require_admin), skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500)):
    db = get_db()
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

@router.get("/products")
async def get_products(u: dict = Depends(require_admin), skip: int=0, limit: int=100):
    db = get_db()
    return await db.products.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

@router.get("/suppliers/pending")
async def get_pending_suppliers(u: dict = Depends(require_admin)):
    db = get_db()
    suppliers = await db.users.find({"user_type": "supplier", "account_status": "pending_review"},
        {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(100)
    for s in suppliers:
        s["anonymous_id"] = generate_anonymous_id(s["id"])
    return suppliers

@router.get("/bypass-attempts")
async def get_bypass(u: dict = Depends(require_admin)):
    db = get_db()
    return await db.bypass_attempts.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)

@router.put("/users/{user_id}/approve")
async def approve_user(user_id: str, u: dict = Depends(require_admin)):
    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user: raise HTTPException(404, "Utilisateur non trouvé")
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "active"}})
    await send_email(user["email"], "Compte activé — AfriSupply", tpl_approved(user["full_name"]))
    return {"message": "Approuvé"}

# Legacy POST compat
@router.post("/approve-supplier/{user_id}")
async def approve_supplier_legacy(user_id: str, u: dict = Depends(require_admin)):
    return await approve_user(user_id, u)

@router.put("/users/{user_id}/reject")
async def reject_user(user_id: str, u: dict = Depends(require_admin)):
    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user: raise HTTPException(404, "Utilisateur non trouvé")
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "rejected"}})
    await send_email(user["email"], "Statut de votre dossier — AfriSupply", tpl_rejected(user["full_name"]))
    return {"message": "Rejeté"}

@router.post("/reject-supplier/{user_id}")
async def reject_supplier_legacy(user_id: str, u: dict = Depends(require_admin)):
    return await reject_user(user_id, u)

@router.put("/users/{user_id}/suspend")
async def suspend_user(user_id: str, u: dict = Depends(require_admin)):
    db = get_db()
    await db.users.update_one({"id": user_id}, {"$set": {"account_status": "suspended"}})
    return {"message": "Suspendu"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, u: dict = Depends(require_admin)):
    """Soft-delete: anonymise l'utilisateur + désactive ses produits + invalide ses sessions.
    On ne supprime jamais physiquement (intégrité référentielle commandes/RFQ/messages)."""
    db = get_db()
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target: raise HTTPException(404, "Utilisateur non trouvé")
    if target.get("user_type") == "admin": raise HTTPException(400, "Suppression d'un admin interdite")
    now = datetime.now(timezone.utc).isoformat()
    anon_email = f"deleted-{user_id[:8]}@deleted.afrisupply.local"
    await db.users.update_one({"id": user_id}, {"$set": {
        "account_status": "deleted", "email": anon_email, "full_name": "[Compte supprimé]",
        "company_name": None, "phone": None, "city": None, "country": None,
        "company_documents": [], "deleted_at": now,
    }, "$unset": {"password_hash": "", "email_verification_token": "", "password_reset_token": ""}})
    # Cascade: désactiver produits + cache invalidation
    await db.products.update_many({"supplier_id": user_id}, {"$set": {"is_available": False, "is_approved": False}})
    await cache_del_pattern("popular:*")
    await cache_del_pattern(f"supplier:{user_id}*")
    return {"message": "Compte anonymisé et désactivé"}

@router.put("/products/{product_id}/approve")
async def approve_product(product_id: str, u: dict = Depends(require_admin)):
    db = get_db()
    await db.products.update_one({"id": product_id}, {"$set": {"is_approved": True, "is_available": True}})
    await cache_del_pattern("popular:*")
    return {"message": "Produit approuvé"}

@router.put("/products/{product_id}/reject")
async def reject_product(product_id: str, u: dict = Depends(require_admin)):
    db = get_db()
    await db.products.update_one({"id": product_id}, {"$set": {"is_available": False, "is_approved": False}})
    return {"message": "Produit rejeté"}

@router.get("/categories")
async def get_categories(u: dict = Depends(require_admin)):
    db = get_db()
    return await db.categories.find({}, {"_id": 0}).to_list(100)

@router.post("/categories")
async def create_category(data: CategoryCreate, u: dict = Depends(require_admin)):
    db = get_db()
    doc = {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), **data.model_dump(exclude_none=True)}
    await db.categories.insert_one(doc)
    await cache_del_pattern("cat:*")
    return doc

@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, force: bool = False, u: dict = Depends(require_admin)):
    """Refuse la suppression si des produits utilisent encore la catégorie.
    Passe ?force=true pour réassigner les produits orphelins (category_id=null)."""
    db = get_db()
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat: raise HTTPException(404, "Catégorie non trouvée")
    used = await db.products.count_documents({"category_id": cat_id})
    if used > 0 and not force:
        raise HTTPException(409, f"{used} produit(s) utilisent cette catégorie. Utilisez ?force=true pour les détacher.")
    if used > 0 and force:
        await db.products.update_many({"category_id": cat_id}, {"$set": {"category_id": None}})
    await db.categories.delete_one({"id": cat_id})
    await cache_del_pattern("cat:*")
    return {"message": "Catégorie supprimée", "products_detached": used if force else 0}

@router.get("/payment-transactions/pending-momo")
async def list_pending_momo(u: dict = Depends(require_admin)):
    """Liste des paiements Mobile Money en attente de validation manuelle admin."""
    db = get_db()
    txs = await db.payment_transactions.find(
        {"payment_type": "mobile_money", "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).limit(200).to_list(200)
    # Joindre l'email anonymisé du buyer pour traçabilité admin
    user_ids = list({t.get("user_id") for t in txs if t.get("user_id")})
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "email": 1, "full_name": 1})}
    for t in txs:
        u_doc = users.get(t.get("user_id"), {})
        t["buyer_email"] = u_doc.get("email")
        t["buyer_name"] = u_doc.get("full_name")
    return txs

@router.get("/trade-assurance")
async def get_all_escrows(u: dict = Depends(require_admin), skip: int = 0, limit: int = Query(50, le=200)):
    db = get_db()
    return await db.trade_assurance.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

@router.get("/disputes")
async def get_all_disputes(u: dict = Depends(require_admin), skip: int = 0, limit: int = Query(50, le=200)):
    db = get_db()
    return await db.disputes.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

@router.put("/disputes/{dispute_id}/resolve")
async def resolve_dispute(dispute_id: str, data: dict, u: dict = Depends(require_admin)):
    db = get_db()
    dispute = await db.disputes.find_one({"id": dispute_id}, {"_id": 0})
    if not dispute: raise HTTPException(404, "Litige non trouvé")
    resolution = data.get("resolution", "refunded")
    now = datetime.now(timezone.utc).isoformat()
    await db.disputes.update_one({"id": dispute_id}, {"$set": {
        "status": "resolved", "resolution": resolution,
        "resolved_at": now, "resolved_by": u["id"]}})
    await db.trade_assurance.update_one(
        {"id": dispute["ta_id"]}, {"$set": {"status": resolution, "released_at": now}})
    await db.orders.update_one(
        {"id": dispute["order_id"]}, {"$set": {"ta_status": resolution}})
    return {"message": f"Litige resolu — {resolution}"}

# ── Actualites ────────────────────────────────────────────────────────────────

def _slug(title: str) -> str:
    s = re.sub(r"[^\w\s-]", "", title.lower())
    return re.sub(r"[\s_-]+", "-", s).strip("-")[:120]

@router.get("/actualites")
async def list_actualites(published_only: bool = False, u: dict = Depends(require_admin)):
    db = get_db()
    flt = {"is_published": True} if published_only else {}
    return await db.actualites.find(flt, {"_id": 0}).sort("created_at", -1).to_list(200)

@router.post("/actualites", status_code=201)
async def create_actualite(data: ActualiteCreate, u: dict = Depends(require_admin)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    aid = str(uuid.uuid4())
    doc = {
        "id": aid,
        **data.model_dump(exclude_none=True),
        "author_id": u["id"],
        "author_name": u.get("full_name", "Admin"),
        "slug": _slug(data.title),
        "published_at": now if data.is_published else None,
        "created_at": now,
        "updated_at": now,
    }
    await db.actualites.insert_one(doc)
    await log_action(u["id"], u["full_name"], "create_actualite",
                     f"Création actualité: {data.title}", "actualite", doc["id"])
    return doc

@router.put("/actualites/{aid}")
async def update_actualite(aid: str, data: ActualiteUpdate, u: dict = Depends(require_admin)):
    db = get_db()
    existing = await db.actualites.find_one({"id": aid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Actualite non trouvee")
    now = datetime.now(timezone.utc).isoformat()
    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if not updates:
        return existing
    updates["updated_at"] = now
    if updates.get("is_published") and not existing.get("published_at"):
        updates["published_at"] = now
    await db.actualites.update_one({"id": aid}, {"$set": updates})
    return {**existing, **updates}

@router.delete("/actualites/{aid}")
async def delete_actualite(aid: str, u: dict = Depends(require_admin)):
    db = get_db()
    existing = await db.actualites.find_one({"id": aid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Actualite non trouvee")
    # Supprimer fichiers media
    for media in existing.get("media", []):
        try:
            fpath = Path(media["url"].lstrip("/"))
            if fpath.exists():
                fpath.unlink()
        except Exception:
            pass
    await db.actualites.delete_one({"id": aid})
    await log_action(u["id"], u["full_name"], "delete_actualite",
                     f"Suppression actualité {aid}", "actualite", aid)
    return {"ok": True}

_ALLOWED_MEDIA = {
    "image/jpeg": "image", "image/png": "image", "image/webp": "image", "image/gif": "image",
    "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
    "application/pdf": "document",
    "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
}
_MAX_SIZE = 50 * 1024 * 1024  # 50 MB

@router.post("/actualites/{aid}/upload")
async def upload_actualite_media(
    aid: str,
    file: UploadFile = File(...),
    u: dict = Depends(require_admin),
):
    db = get_db()
    existing = await db.actualites.find_one({"id": aid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Actualite non trouvee")

    content_type = file.content_type or ""
    media_type = _ALLOWED_MEDIA.get(content_type)
    if not media_type:
        raise HTTPException(400, f"Type de fichier non autorisé : {content_type}")

    raw = await file.read()
    if len(raw) > _MAX_SIZE:
        raise HTTPException(413, "Fichier trop volumineux (max 50 Mo)")

    ext = Path(file.filename).suffix.lower() if file.filename else ""
    fname = f"{aid}_{uuid.uuid4().hex[:8]}{ext}"
    fpath = MEDIA_DIR / fname
    fpath.write_bytes(raw)

    media_item = {
        "url": f"/uploads/blog/{fname}",
        "type": media_type,
        "filename": file.filename or fname,
        "size": len(raw),
    }
    await db.actualites.update_one({"id": aid}, {"$push": {"media": media_item}})
    return media_item


@router.delete("/actualites/{aid}/media")
async def delete_actualite_media(
    aid: str,
    url: str,
    u: dict = Depends(require_admin),
):
    db = get_db()
    existing = await db.actualites.find_one({"id": aid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Actualite non trouvee")

    await db.actualites.update_one({"id": aid}, {"$pull": {"media": {"url": url}}})
    try:
        fpath = Path(url.lstrip("/"))
        if fpath.exists():
            fpath.unlink()
    except Exception:
        pass
    return {"ok": True}


# ── Badge assignment ─────────────────────────────────────────────────────────
@router.post("/suppliers/{supplier_id}/badge")
async def set_supplier_badge(
    supplier_id: str,
    data: dict,
    u: dict = Depends(require_admin),
):
    """Admin assigns or revokes a badge on a supplier. data = {badge, action: 'add'|'remove'}"""
    badge = data.get("badge", "").strip()
    action = data.get("action", "add")
    if badge not in ADMIN_ASSIGNABLE_BADGES:
        raise HTTPException(400, f"Badge non attribuable: {badge}. Autorisés: {ADMIN_ASSIGNABLE_BADGES}")
    if action not in ("add", "remove"):
        raise HTTPException(400, "action doit être 'add' ou 'remove'")
    db = get_db()
    s = await db.users.find_one({"id": supplier_id, "user_type": "supplier"}, {"_id": 0, "id": 1, "company_name": 1})
    if not s:
        raise HTTPException(404, "Fournisseur non trouvé")
    if action == "add":
        await db.users.update_one({"id": supplier_id}, {"$addToSet": {"admin_badges": badge}})
    else:
        await db.users.update_one({"id": supplier_id}, {"$pull": {"admin_badges": badge}})
    from services.cache_service import cache_del
    await cache_del(f"supplier:{supplier_id}")
    await cache_del(f"badges:{supplier_id}")
    admin_name = u.get("full_name") or u.get("email", "admin")
    await log_action(u["id"], admin_name, f"badge_{action}", f"Badge '{badge}' {'attribué à' if action=='add' else 'retiré de'} {s.get('company_name', supplier_id)}", "supplier", supplier_id)
    return {"ok": True, "badge": badge, "action": action}


# ── Orphan products diagnostic & fix ─────────────────────────────────────────
@router.get("/products/orphans")
async def get_orphan_products(u: dict = Depends(require_admin)):
    """Detect products whose supplier_id doesn't match any user."""
    db = get_db()
    product_sids = await db.products.distinct("supplier_id")
    valid_ids = set(await db.users.distinct("id", {"user_type": "supplier"}))
    orphan_sids = [sid for sid in product_sids if sid not in valid_ids]
    result = []
    for sid in orphan_sids:
        products = await db.products.find(
            {"supplier_id": sid}, {"_id": 0, "id": 1, "name": 1, "supplier_id": 1}
        ).to_list(100)
        result.append({"orphan_supplier_id": sid, "products": products, "count": len(products)})
    return {"orphan_groups": result, "total_orphan_products": sum(r["count"] for r in result)}

@router.post("/products/orphans/reassign")
async def reassign_orphan_products(data: dict, u: dict = Depends(require_admin)):
    """Reassign orphan products to a valid supplier. data = {orphan_supplier_id, new_supplier_id}"""
    orphan_id = data.get("orphan_supplier_id", "").strip()
    new_id    = data.get("new_supplier_id", "").strip()
    if not orphan_id or not new_id:
        raise HTTPException(400, "orphan_supplier_id et new_supplier_id requis")
    db = get_db()
    new_sup = await db.users.find_one({"id": new_id, "user_type": "supplier"}, {"_id": 0, "id": 1})
    if not new_sup:
        raise HTTPException(404, f"Fournisseur cible {new_id} introuvable")
    result = await db.products.update_many(
        {"supplier_id": orphan_id},
        {"$set": {"supplier_id": new_id}}
    )
    admin_name = u.get("full_name") or u.get("email", "admin")
    await log_action(u["id"], admin_name, "reassign_orphan_products",
        f"{result.modified_count} produits réaffectés de {orphan_id[:8]} vers {new_id[:8]}")
    return {"ok": True, "modified": result.modified_count}

@router.delete("/products/orphans")
async def delete_orphan_products(u: dict = Depends(require_admin)):
    """Delete all products with no matching supplier user."""
    db = get_db()
    product_sids = await db.products.distinct("supplier_id")
    valid_ids = set(await db.users.distinct("id", {"user_type": "supplier"}))
    orphan_sids = [sid for sid in product_sids if sid not in valid_ids]
    if not orphan_sids:
        return {"ok": True, "deleted": 0, "message": "Aucun produit orphelin"}
    result = await db.products.delete_many({"supplier_id": {"$in": orphan_sids}})
    admin_name = u.get("full_name") or u.get("email", "admin")
    await log_action(u["id"], admin_name, "delete_orphan_products",
        f"{result.deleted_count} produits orphelins supprimés")
    return {"ok": True, "deleted": result.deleted_count}


# ── Migration: backfill anonymous_id on all existing users ───────────────────
@router.post("/migrate/anonymous-ids")
async def migrate_anonymous_ids(u: dict = Depends(require_admin)):
    """One-time migration: compute and store anonymous_id for all users who don't have one."""
    import hashlib
    db = get_db()
    users = await db.users.find({"anonymous_id": {"$exists": False}}, {"id": 1}).to_list(10000)
    count = 0
    for user in users:
        uid = user.get("id")
        if not uid:
            continue
        anon = f"Partenaire-{hashlib.sha256(uid.encode()).hexdigest()[:6].upper()}"
        await db.users.update_one({"id": uid}, {"$set": {"anonymous_id": anon}})
        count += 1
    admin_name = u.get("full_name") or u.get("email", "admin")
    await log_action(u["id"], admin_name, "migrate_anonymous_ids", f"{count} utilisateurs migrés")
    return {"ok": True, "migrated": count}
