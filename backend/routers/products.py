from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import Response
from typing import Optional, List
from pathlib import Path
from datetime import datetime, timezone
import uuid, json, shutil, re, html

from database import get_db
from dependencies import get_current_user, get_current_user_optional, require_supplier, require_active_supplier
from models.product import ProductOut as ProductResponse
from services.cache_service import cache_get, cache_set, cache_del, cache_del_pattern, CACHE_TTL
from services.pdf_service import generate_product_pdf
from services.bypass_service import generate_anonymous_id, localize_anonymous_id
from services.storage_service import upload_image as _upload_image
from config import get_settings
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/products", tags=["products"])
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

def _get_lang(request) -> str:
    accept = getattr(request, "headers", {}).get("accept-language", "fr") if request else "fr"
    return accept[:2].lower() if accept else "fr"

def sanitize(v, n=500):
    return re.sub(r'<[^>]+>', '', html.unescape(str(v)))[:n].strip()

def _build_query(category_id=None, supplier_id=None, search=None, min_price=None, max_price=None, is_available=None, public=True):
    q = {}
    if category_id: q["category_id"] = category_id
    if supplier_id: q["supplier_id"] = supplier_id
    if search: q["$text"] = {"$search": search, "$language": "french"}
    if min_price is not None or max_price is not None:
        q["price"] = {}
        if min_price is not None: q["price"]["$gte"] = min_price
        if max_price is not None: q["price"]["$lte"] = max_price
    if is_available is not None: q["is_available"] = is_available
    # Public listings: only admin-approved products are visible
    if public: q["is_approved"] = True
    return q

async def _enrich(products: list, lang: str = "fr") -> list:
    if not products: return products
    db = get_db()
    cat_ids = sorted({p.get("category_id") for p in products if p.get("category_id")})
    sup_ids = list({p.get("supplier_id") for p in products if p.get("supplier_id")})
    # Cache catégories (TTL 1h) — quasi-statiques, évite 2 Mongo aller-retours par page
    cats_ck = f"cats_bulk:{':'.join(cat_ids)}"
    cats_cached = await cache_get(cats_ck)
    if cats_cached:
        cats = {c["id"]: c for c in cats_cached}
    else:
        cats = {c["id"]: c async for c in db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0})}
        await cache_set(cats_ck, list(cats.values()), 3600)
    sups = {s["id"]: s async for s in db.users.find({"id": {"$in": sup_ids}}, {"_id": 0})}
    for p in products:
        cat = cats.get(p.get("category_id"), {})
        sup = sups.get(p.get("supplier_id"), {})
        p["category_name"] = cat.get("name")
        # STRICT: never expose real supplier identity — localized anonymous ID only
        anon = localize_anonymous_id(
            sup.get("anonymous_id") or generate_anonymous_id(p.get("supplier_id", "")), lang)
        p["supplier_name"] = anon
        p["supplier_company"] = anon
        if p.get("description") is None: p["description"] = ""
    return products

@router.get("/count")
@limiter.limit("100/minute")
async def count_products(request: Request, category_id: Optional[str]=None, supplier_id: Optional[str]=None,
    search: Optional[str]=None, min_price: Optional[float]=None, max_price: Optional[float]=None, is_available: Optional[bool]=None):
    db = get_db()
    return {"count": await db.products.count_documents(_build_query(category_id, supplier_id, search, min_price, max_price, is_available))}

@router.get("/popular", response_model=List[ProductResponse])
@limiter.limit("100/minute")
async def get_popular(request: Request, limit: int=8):
    lang = _get_lang(request)
    cached = await cache_get(f"popular:{limit}:{lang}")
    if cached: return cached
    db = get_db()
    products = await db.products.find({"is_available": True, "is_approved": True}, {"_id": 0}).sort("rating", -1).limit(limit).to_list(limit)
    result = await _enrich(products, lang)
    await cache_set(f"popular:{limit}:{lang}", result, CACHE_TTL["popular_products"])
    return result

@router.get("/recommendations", response_model=List[ProductResponse])
@limiter.limit("100/minute")
async def get_recommendations(request: Request, u: dict = Depends(get_current_user)):
    lang = _get_lang(request)
    db = get_db()
    viewed = u.get("viewed_products", [])[-10:]
    favorites = u.get("favorites", [])
    rec_ids = list(set(viewed + favorites))[:5]
    if rec_ids:
        sample = await db.products.find({"id": {"$in": rec_ids}}, {"_id": 0, "category_id": 1}).to_list(5)
        cat_ids = list({p["category_id"] for p in sample if p.get("category_id")})
        products = await db.products.find({"category_id": {"$in": cat_ids}, "is_available": True, "is_approved": True}, {"_id": 0}).limit(8).to_list(8)
    else:
        products = await db.products.find({"is_available": True, "is_approved": True}, {"_id": 0}).sort("rating", -1).limit(8).to_list(8)
    return await _enrich(products, lang)

@router.get("", response_model=List[ProductResponse])
@limiter.limit("100/minute")
async def get_products(
    request: Request,
    category_id: Optional[str] = None, supplier_id: Optional[str] = None,
    search: Optional[str] = None, min_price: Optional[float] = None, max_price: Optional[float] = None,
    is_available: Optional[bool] = None, sort_by: str = "created_at", sort_order: str = "desc",
    skip: int = 0, limit: int = 20,
    # ── Cursor pagination (scalable à des milliards de produits) ──────────────
    # Passer `after_cursor` (valeur ISO du dernier `created_at` reçu) pour ignorer skip()
    # uniquement disponible quand sort_by=created_at (le seul champ ordonnable comme curseur)
    after_cursor: Optional[str] = None,
):
    lang = _get_lang(request)
    limit = min(limit, 100)
    db = get_db()
    q = _build_query(category_id, supplier_id, search, min_price, max_price, is_available)

    use_cursor = after_cursor and sort_by == "created_at" and not search
    if use_cursor:
        # Cursor-based: O(log N) index seek — jamais de skip profond
        direction = -1 if sort_order == "desc" else 1
        cursor_op = "$lt" if sort_order == "desc" else "$gt"
        q["created_at"] = {cursor_op: after_cursor}
        products = await db.products.find(q, {"_id": 0}).sort("created_at", direction).limit(limit).to_list(limit)
        return await _enrich(products, lang)

    # Skip-based (pages numérotées, acceptable jusqu'à ~page 200 max)
    use_cache = not search and skip == 0 and limit <= 20 and not after_cursor
    if use_cache:
        ck = f"products:{category_id}:{supplier_id}:{min_price}:{max_price}:{is_available}:{sort_by}:{sort_order}:{limit}:{lang}"
        cached = await cache_get(ck)
        if cached: return cached
    direction = -1 if sort_order == "desc" else 1
    products = await db.products.find(q, {"_id": 0}).sort(sort_by, direction).skip(skip).limit(limit).to_list(limit)
    result = await _enrich(products, lang)
    if use_cache:
        await cache_set(ck, result, CACHE_TTL["product_list"])
    return result

@router.get("/{product_id}", response_model=ProductResponse)
@limiter.limit("100/minute")
async def get_product(request: Request, product_id: str, u: dict = Depends(get_current_user_optional)):
    lang = _get_lang(request)
    ck = f"product:{product_id}:{lang}"
    cached = await cache_get(ck)
    if not cached:
        db = get_db()
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not product: raise HTTPException(404, "Produit non trouvé")
        enriched = await _enrich([product], lang)
        cached = enriched[0]
        await cache_set(ck, cached, CACHE_TTL["product"])
    if u:
        db = get_db()
        await db.users.update_one({"id": u["id"]}, {"$addToSet": {"viewed_products": product_id}})
    return cached

@router.get("/{product_id}/sheet")
@limiter.limit("20/minute")
async def get_product_sheet(request: Request, product_id: str, u: dict = Depends(get_current_user_optional)):
    db = get_db()
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product: raise HTTPException(404, "Produit non trouvé")
    cat = await db.categories.find_one({"id": product.get("category_id")}, {"_id": 0}) or {}
    product["category_name"] = cat.get("name")
    supplier = await db.users.find_one({"id": product.get("supplier_id")}, {"_id": 0}) or {}
    unlocked = False
    if u:
        paid = await db.orders.find_one({"buyer_id": u["id"], "supplier_id": product.get("supplier_id"), "payment_status": "paid"})
        unlocked = paid is not None
    pdf_bytes = await generate_product_pdf(product, supplier, unlocked)
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", product.get("name",""))[:40]
    fname = f"AfriSupply_{safe}_{product_id[:8].upper()}.pdf"
    return Response(content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})

@router.post("", response_model=ProductResponse)
@limiter.limit("20/minute")
async def create_product(request: Request,
    name: str=Form(...), description: str=Form(""), price: float=Form(...),
    unit: str=Form("unité"), min_order_quantity: int=Form(1), stock_quantity: int=Form(0),
    category_id: str=Form(...), specifications: str=Form("{}"), is_available: bool=Form(True),
    images: List[UploadFile]=File([]), u: dict=Depends(require_active_supplier)):
    db = get_db()
    image_urls = []
    for img in images:
        if img.content_type and img.content_type.startswith("image/"):
            content = await img.read()
            ext = Path(img.filename or ".jpg").suffix.lower()
            fname = f"{uuid.uuid4()}{ext}"
            try:
                url = await _upload_image(content, fname)
                image_urls.append(url)
            except ValueError as e:
                raise HTTPException(400, str(e))
    try: specs = json.loads(specifications)
    except (json.JSONDecodeError, ValueError): specs = {}
    pid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": pid, "name": sanitize(name, 200), "description": sanitize(description, 5000),
        "price": price, "unit": unit, "min_order_quantity": min_order_quantity,
        "stock_quantity": stock_quantity, "category_id": category_id, "specifications": specs,
        "images": image_urls, "is_available": is_available, "is_approved": False,
        "supplier_id": u["id"], "rating": 0.0, "rating_sum": 0.0, "review_count": 0, "created_at": now}
    await db.products.insert_one(doc)
    await cache_del_pattern("popular:*")
    cat = await db.categories.find_one({"id": category_id}, {"_id": 0}) or {}
    doc["category_name"] = cat.get("name"); doc["supplier_name"] = u.get("anonymous_id") or generate_anonymous_id(u["id"]); doc["supplier_company"] = u.get("anonymous_id") or generate_anonymous_id(u["id"])
    return ProductResponse(**doc)

@router.put("/{product_id}", response_model=ProductResponse)
@limiter.limit("20/minute")
async def update_product(request: Request, product_id: str,
    name: Optional[str]=Form(None), description: Optional[str]=Form(None),
    price: Optional[float]=Form(None), unit: Optional[str]=Form(None),
    min_order_quantity: Optional[int]=Form(None), stock_quantity: Optional[int]=Form(None),
    category_id: Optional[str]=Form(None), specifications: Optional[str]=Form(None),
    is_available: Optional[bool]=Form(None), existing_images: str=Form("[]"),
    images: List[UploadFile]=File([]), u: dict=Depends(get_current_user)):
    db = get_db()
    product = await db.products.find_one({"id": product_id})
    if not product: raise HTTPException(404, "Produit non trouvé")
    if product["supplier_id"] != u["id"]: raise HTTPException(403, "Accès refusé")
    try: existing = json.loads(existing_images)
    except (json.JSONDecodeError, ValueError): existing = []
    new_urls = []
    for img in images:
        if img.content_type and img.content_type.startswith("image/"):
            content = await img.read()
            ext = Path(img.filename or ".jpg").suffix.lower()
            fname = f"{uuid.uuid4()}{ext}"
            try:
                url = await _upload_image(content, fname)
                new_urls.append(url)
            except ValueError:
                continue  # ignorer images invalides en édition
    update = {}
    if name: update["name"] = sanitize(name, 200)
    if description is not None: update["description"] = sanitize(description, 5000)
    if price is not None: update["price"] = price
    if unit: update["unit"] = unit
    if min_order_quantity is not None: update["min_order_quantity"] = min_order_quantity
    if stock_quantity is not None: update["stock_quantity"] = stock_quantity
    if category_id: update["category_id"] = category_id
    if specifications:
        try: update["specifications"] = json.loads(specifications)
        except (json.JSONDecodeError, ValueError): pass
    if is_available is not None: update["is_available"] = is_available
    if existing or new_urls: update["images"] = existing + new_urls
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"id": product_id}, {"$set": update})
    await cache_del_pattern(f"product:{product_id}:*")
    await cache_del_pattern("popular:*")
    lang = _get_lang(request)
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    enriched = await _enrich([updated], lang)
    return ProductResponse(**enriched[0])

@router.delete("/{product_id}")
async def delete_product(product_id: str, u: dict=Depends(get_current_user)):
    db = get_db()
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Produit non trouvé")
    if p["supplier_id"] != u["id"]: raise HTTPException(403, "Accès refusé")
    await db.products.delete_one({"id": product_id})
    await cache_del(f"product:{product_id}")
    await cache_del_pattern("popular:*")
    return {"message": "Produit supprimé"}

@router.get("/{product_id}/reviews")
async def get_product_reviews(product_id: str, skip: int=0, limit: int=10):
    db = get_db()
    return await db.reviews.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
