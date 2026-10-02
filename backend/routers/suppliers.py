from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional
from models.common import SupplierRating
from models.storefront import StorefrontUpdate, StorefrontOut
from database import get_db
from dependencies import get_current_user, get_current_user_optional, require_supplier, require_active_supplier
from services.cache_service import cache_get, cache_set, cache_del, CACHE_TTL
from services.badge_service import calculate_badges, BADGE_META
from services.bypass_service import generate_anonymous_id, localize_anonymous_id
from datetime import datetime, timezone
import uuid, re, asyncio

router = APIRouter(tags=["suppliers"])

def _get_lang(request) -> str:
    """Extrait la langue depuis Accept-Language (ex: 'en-US,en;q=0.9' → 'en')."""
    accept = getattr(request, "headers", {}).get("accept-language", "fr") if request else "fr"
    return accept[:2].lower() if accept else "fr"

async def _enrich_supplier(s: dict, db, include_contact: bool = False, lang: str = "fr") -> dict:
    """Enrich supplier — NEVER expose personal info unless include_contact=True."""
    # Run all 4 DB queries in parallel — reduces latency from ~4x to ~1x
    prod_count, res, badges, order_count = await asyncio.gather(
        db.products.count_documents({"supplier_id": s["id"], "is_available": True, "is_approved": True}),
        db.reviews.aggregate([
            {"$match": {"supplier_id": s["id"]}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]).to_list(1),
        calculate_badges(s["id"]),
        db.orders.count_documents({"supplier_id": s["id"], "status": "delivered"}),
    )
    _anon = localize_anonymous_id(
        s.get("anonymous_id") or generate_anonymous_id(s["id"]), lang
    )
    result = {
        "id": s["id"],
        "company_name": _anon,
        "country": s.get("country"), "city": s.get("city"),
        "user_type": "supplier",
        "account_status": s.get("account_status"),
        # Fields matching frontend expectations
        "product_count": prod_count, "products_count": prod_count,
        "review_count": res[0]["count"] if res else 0, "rating_count": res[0]["count"] if res else 0,
        "avg_rating": round(res[0]["avg"], 1) if res else 0.0,
        "rating": round(res[0]["avg"], 1) if res else 0.0,
        "orders_completed": order_count,
        "member_since": s.get("created_at"),
        "badges": badges,
        "badge_details": [BADGE_META.get(b, {}) for b in badges],
        "created_at": s.get("created_at"),
        # NUI + RC sont des identifiants légaux d'entreprise — publics
        "nui": s.get("nui") or None,
        "rc_number": s.get("rc_number") or None,
    }
    # NEVER expose personal info publicly — company_name revealed only after payment unlock
    if not include_contact:
        result["full_name"] = _anon
        result["phone"] = None
        result["email"] = None
    else:
        result["company_name"] = s.get("company_name") or result["company_name"]
        result["full_name"] = s.get("full_name")
    return result

# ── Self-service supplier endpoints ─────────────────────────────────────────
@router.get("/supplier/products")
async def get_my_products(u: dict = Depends(require_supplier), skip: int=0, limit: int=50):
    db = get_db()
    return await db.products.find({"supplier_id": u["id"]}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

@router.get("/supplier/stats")
async def get_my_stats(u: dict = Depends(require_supplier)):
    sid = u["id"]
    cache_key = f"supplier_stats:{sid}"
    cached = await cache_get(cache_key)
    if cached: return cached
    db = get_db()
    order_pipeline = [{"$match": {"supplier_id": sid}}, {"$group": {"_id": None,
        "total_orders": {"$sum": 1},
        "pending_orders": {"$sum": {"$cond": [{"$eq": ["$status","pending"]}, 1, 0]}},
        "completed_orders": {"$sum": {"$cond": [{"$eq": ["$status","delivered"]}, 1, 0]}},
        "total_revenue": {"$sum": {"$cond": [{"$eq": ["$payment_status","paid"]}, "$total", 0]}}}}]
    rfq_pipeline = [{"$match": {"supplier_id": sid}}, {"$group": {"_id": None,
        "total_rfqs": {"$sum": 1},
        "pending_rfqs": {"$sum": {"$cond": [{"$eq": ["$status","pending"]}, 1, 0]}}}}]
    o = (await db.orders.aggregate(order_pipeline).to_list(1) or [{}])[0]
    r = (await db.rfqs.aggregate(rfq_pipeline).to_list(1) or [{}])[0]
    result = {"products_count": await db.products.count_documents({"supplier_id": sid}),
        "total_orders": o.get("total_orders", 0), "pending_orders": o.get("pending_orders", 0),
        "completed_orders": o.get("completed_orders", 0), "total_revenue": o.get("total_revenue", 0),
        "total_rfqs": r.get("total_rfqs", 0), "pending_rfqs": r.get("pending_rfqs", 0)}
    await cache_set(cache_key, result, 60)
    return result

# ── Contact unlock status ────────────────────────────────────────────────────
@router.get("/contacts/{partner_id}/unlock-status")
async def get_unlock_status(partner_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    partner = await db.users.find_one({"id": partner_id}, {"_id": 0, "password_hash": 0})
    if not partner: raise HTTPException(404, "Partenaire introuvable")
    paid = await db.orders.find_one({"buyer_id": u["id"], "supplier_id": partner_id, "payment_status": "paid"}, {"_id": 0})
    has_transaction = paid is not None
    # STRICT: NEVER expose personal info — only confirm transaction exists
    return {"has_transaction": has_transaction, "partner_id": partner_id,
        "partner_name": generate_anonymous_id(partner_id),
        "partner_country": partner.get("country"),
        "message": "Utilisez la messagerie AfriSupply pour communiquer." if has_transaction else "Finalisez une commande pour accéder à la messagerie."}

# ── Bypass self-history (admin only) ────────────────────────────────────────
@router.get("/bypass-attempts/mine")
async def get_bypass_mine(u: dict = Depends(get_current_user)):
    if u.get("user_type") != "admin": raise HTTPException(403, "Admins uniquement")
    db = get_db()
    return await db.bypass_attempts.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)

# ── Public supplier endpoints ────────────────────────────────────────────────
@router.get("/suppliers")
async def get_suppliers(request: Request, category: Optional[str]=None, country: Optional[str]=None,
    search: Optional[str]=None, skip: int=0, limit: int=20):
    """Single-aggregate listing: zero N+1 — products & orders counted via $lookup."""
    db = get_db()
    match: dict = {"user_type": "supplier", "account_status": "active"}
    if category: match["categories"] = {"$in": [category]}
    if country: match["country"] = country
    if search: match["company_name"] = {"$regex": search, "$options": "i"}
    pipeline = [
        {"$match": match},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$lookup": {
            "from": "products", "let": {"sid": "$id"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$supplier_id", "$$sid"]},
                    {"$eq": ["$is_available", True]},
                    {"$eq": ["$is_approved", True]},
                ]}}},
                {"$count": "n"},
            ],
            "as": "_prods",
        }},
        {"$lookup": {
            "from": "orders", "let": {"sid": "$id"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$supplier_id", "$$sid"]},
                    {"$eq": ["$status", "delivered"]},
                ]}}},
                {"$count": "n"},
            ],
            "as": "_orders",
        }},
        {"$lookup": {
            "from": "reviews", "let": {"sid": "$id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$supplier_id", "$$sid"]}}},
                {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
            ],
            "as": "_rev",
        }},
        {"$project": {
            "_id": 0, "id": 1, "company_name": 1, "country": 1, "city": 1, "created_at": 1,
            "products_count": {"$ifNull": [{"$arrayElemAt": ["$_prods.n", 0]}, 0]},
            "orders_completed": {"$ifNull": [{"$arrayElemAt": ["$_orders.n", 0]}, 0]},
            "rating": {"$ifNull": [{"$arrayElemAt": ["$_rev.avg", 0]}, 0.0]},
            "rating_count": {"$ifNull": [{"$arrayElemAt": ["$_rev.count", 0]}, 0]},
        }},
    ]
    lang = _get_lang(request)
    ck = f"suppliers_list:{category or ''}:{country or ''}:{search or ''}:{skip}:{limit}:{lang}"
    if not search:  # don't cache search results — too varied
        cached = await cache_get(ck)
        if cached: return cached
    rows = await db.users.aggregate(pipeline).to_list(limit)
    for r in rows:
        _anon = localize_anonymous_id(r.get("anonymous_id") or generate_anonymous_id(r["id"]), lang)
        r["company_name"] = _anon
        r["full_name"] = _anon
        r["product_count"] = r["products_count"]
        r["rating"] = round(r["rating"], 1)
    if not search:
        await cache_set(ck, rows, CACHE_TTL["supplier_list"])
    return rows

@router.get("/suppliers/{supplier_id}/profile")
@router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str, request: Request, u: dict = Depends(get_current_user_optional)):
    lang = _get_lang(request)
    cache_key = f"supplier:{supplier_id}:{lang}"
    cached = await cache_get(cache_key)
    if cached: return cached
    db = get_db()
    s = await db.users.find_one({"id": supplier_id, "user_type": "supplier"}, {"_id": 0, "password_hash": 0})
    if not s: raise HTTPException(404, "Fournisseur non trouvé")
    enriched = await _enrich_supplier(s, db, lang=lang)
    await cache_set(cache_key, enriched, 60)
    return enriched

@router.get("/suppliers/{supplier_id}/products")
async def get_supplier_products(supplier_id: str, skip: int=0, limit: int=20):
    db = get_db()
    return await db.products.find({"supplier_id": supplier_id, "is_available": True, "is_approved": True}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)

@router.get("/suppliers/{supplier_id}/ratings")
@router.get("/suppliers/{supplier_id}/reviews")
async def get_reviews(supplier_id: str, request: Request, skip: int=0, limit: int=10):
    db = get_db()
    lang = _get_lang(request)
    rows = await db.reviews.find({"supplier_id": supplier_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for r in rows:
        if r.get("buyer_name"):
            r["buyer_name"] = localize_anonymous_id(r["buyer_name"], lang)
    return rows

@router.post("/suppliers/{supplier_id}/rate")
async def rate_supplier(supplier_id: str, data: SupplierRating, u: dict = Depends(get_current_user)):
    db = get_db()
    if not await db.orders.find_one({"buyer_id": u["id"], "supplier_id": supplier_id, "payment_status": "paid"}):
        raise HTTPException(403, "Commande payée requise")
    if not 1 <= data.rating <= 5: raise HTTPException(400, "Note entre 1 et 5")
    review = {"id": str(uuid.uuid4()), "supplier_id": supplier_id, "buyer_id": u["id"],
        "buyer_name": u.get("anonymous_id") or generate_anonymous_id(u["id"]), "rating": data.rating,
        "comment": data.comment[:500],
        "created_at": datetime.now(timezone.utc).isoformat()}
    await db.reviews.update_one({"supplier_id": supplier_id, "buyer_id": u["id"]},
        {"$set": review}, upsert=True)
    await cache_del(f"supplier:{supplier_id}")
    return {"message": "Avis soumis"}

# ── Supplier profile update (NUI + RC) ──────────────────────────────────────
@router.put("/supplier/profile")
async def update_supplier_profile(data: dict, u: dict = Depends(require_supplier)):
    """Supplier updates their NUI and RC number for identity_verified badge."""
    db = get_db()
    allowed = {}
    if "nui" in data:
        nui = str(data["nui"]).strip()[:50]
        if not re.match(r'^[A-Z0-9\-\/]+$', nui, re.IGNORECASE):
            raise HTTPException(400, "NUI invalide")
        allowed["nui"] = nui
    if "rc_number" in data:
        rc = str(data["rc_number"]).strip()[:100]
        if not re.match(r'^[A-Z0-9\-\/\s]+$', rc, re.IGNORECASE):
            raise HTTPException(400, "Numéro RC invalide")
        allowed["rc_number"] = rc
    if not allowed:
        raise HTTPException(400, "Aucune donnée valide")
    await db.users.update_one({"id": u["id"]}, {"$set": allowed})
    await cache_del(f"supplier:{u['id']}")
    await cache_del(f"badges:{u['id']}")
    return {"ok": True}

# ── Badges ───────────────────────────────────────────────────────────────────
@router.get("/suppliers/{supplier_id}/badges")
async def get_badges(supplier_id: str):
    badges = await calculate_badges(supplier_id)
    return {"badges": badges, "details": [BADGE_META.get(b, {}) for b in badges]}

@router.get("/badges/meta")
async def get_badge_meta():
    return BADGE_META

# ── Storefront CRUD ──────────────────────────────────────────────────────────
@router.get("/storefront/mine")
async def get_my_storefront(u: dict = Depends(require_active_supplier)):
    db = get_db()
    sf = await db.storefronts.find_one({"supplier_id": u["id"]}, {"_id": 0})
    if not sf:
        return {"supplier_id": u["id"], "slug": u["id"][:12], "badges": await calculate_badges(u["id"])}
    sf["badges"] = await calculate_badges(u["id"])
    return sf

@router.put("/storefront/mine")
async def update_my_storefront(data: StorefrontUpdate, u: dict = Depends(require_active_supplier)):
    db = get_db()
    update = data.model_dump(exclude_none=True)
    # Validate slug uniqueness
    if "slug" in update:
        slug = re.sub(r"[^a-z0-9-]", "", update["slug"].lower().strip())[:50]
        if not slug: slug = u["id"][:12]
        existing = await db.storefronts.find_one({"slug": slug, "supplier_id": {"$ne": u["id"]}})
        if existing: raise HTTPException(400, "Ce slug est déjà utilisé")
        update["slug"] = slug
    update["supplier_id"] = u["id"]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.storefronts.update_one({"supplier_id": u["id"]}, {"$set": update}, upsert=True)
    return await db.storefronts.find_one({"supplier_id": u["id"]}, {"_id": 0})

# ── Public Storefront (by slug) ─────────────────────────────────────────────
@router.get("/store/{slug}")
async def get_storefront_by_slug(slug: str):
    db = get_db()
    sf = await db.storefronts.find_one({"slug": slug}, {"_id": 0})
    if not sf:
        # Try supplier_id as fallback
        supplier = await db.users.find_one({"id": slug, "user_type": "supplier", "account_status": "active"}, {"_id": 0, "password_hash": 0})
        if not supplier: raise HTTPException(404, "Boutique non trouvée")
        sf = {"supplier_id": supplier["id"], "slug": slug}
    supplier = await db.users.find_one({"id": sf["supplier_id"], "user_type": "supplier"}, {"_id": 0, "password_hash": 0})
    if not supplier or supplier.get("account_status") != "active":
        raise HTTPException(404, "Boutique non trouvée")
    enriched = await _enrich_supplier(supplier, db, include_contact=False)
    products = await db.products.find({"supplier_id": sf["supplier_id"], "is_available": True, "is_approved": True}, {"_id": 0}).limit(20).to_list(20)
    return {"storefront": sf, "supplier": enriched, "products": products}
