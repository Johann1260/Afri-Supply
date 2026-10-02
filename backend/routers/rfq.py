from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from typing import Optional
from datetime import datetime, timezone
import uuid, re

from database import get_db
from dependencies import get_current_user
from models.rfq import RFQCreate, PublicRFQCreate, RFQOut
from routers.notifications import create_notification
from services.bypass_service import generate_anonymous_id, localize_anonymous_id, detect_bypass

router = APIRouter(prefix="/rfq", tags=["rfq"])

def _get_lang(request) -> str:
    accept = getattr(request, "headers", {}).get("accept-language", "fr") if request else "fr"
    return accept[:2].lower() if accept else "fr"

def _make_rfq_number() -> str:
    return f"RFQ-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

def _anonymize(rfq: dict, viewer_id: str, lang: str = "fr") -> dict:
    r = dict(rfq)
    if r.get("buyer_id") != viewer_id:
        r["buyer_name"] = localize_anonymous_id(
            r.get("buyer_name") or generate_anonymous_id(r.get("buyer_id", "")), lang)
        r["buyer_company"] = None
    if r.get("supplier_id") and r.get("supplier_id") != viewer_id:
        r["supplier_name"] = localize_anonymous_id(
            r.get("supplier_name") or generate_anonymous_id(r.get("supplier_id", "")), lang)
    return r

_CONTACT_PATTERN = re.compile(
    r"(\+?\d[\d\s\-]{7,}\d|[\w.+-]+@[\w-]+\.[a-z]{2,}"
    r"|whatsapp|telegram|signal|email|appel|call|contact direct)",
    re.IGNORECASE,
)

async def _check_text_bypass(db, user_id: str, *fields: str):
    text = " ".join(f for f in fields if f)
    if _CONTACT_PATTERN.search(text) or detect_bypass(text):
        raise HTTPException(400, "Coordonnees directes interdites avant paiement")

async def _enrich_rfq(db, rfq: dict) -> dict:
    rfq_id = rfq.get("id")
    pipeline = [
        {"$match": {"rfq_id": rfq_id, "status": {"$ne": "rejected"}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "best_price": {"$min": "$unit_price"}}},
    ]
    agg = await db.quotations.aggregate(pipeline).to_list(1)
    if agg:
        rfq["quote_count"] = agg[0]["count"]
        rfq["best_price"] = agg[0]["best_price"]
    else:
        rfq["quote_count"] = 0
        rfq["best_price"] = None
    return rfq

@router.post("", response_model=RFQOut, status_code=201)
async def create_rfq(data: RFQCreate, u: dict = Depends(get_current_user)):
    if u.get("user_type") not in ("buyer", "admin"):
        raise HTTPException(403, "Acheteur uniquement")
    db = get_db()
    product = await db.products.find_one({"id": data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produit non trouve")
    supplier = await db.users.find_one(
        {"id": product["supplier_id"], "user_type": "supplier", "account_status": "active"}, {"_id": 0})
    if not supplier:
        raise HTTPException(404, "Fournisseur non disponible")
    await _check_text_bypass(db, u["id"], data.specifications or "", data.notes or "")
    rid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": rid, "rfq_number": _make_rfq_number(), "rfq_type": "private",
        "product_id": data.product_id, "product_name": product.get("name", ""),
        "supplier_id": product["supplier_id"],
        "supplier_name": generate_anonymous_id(product["supplier_id"]),
        "buyer_id": u["id"], "buyer_name": u.get("anonymous_id") or generate_anonymous_id(u["id"]),
        "quantity": data.quantity, "unit": "unite",
        "target_price": data.target_price, "delivery_location": data.delivery_location,
        "delivery_deadline": data.delivery_deadline, "specifications": data.specifications,
        "notes": data.notes, "status": "open", "quote_count": 0, "best_price": None,
        "accepted_quotation_id": None, "created_at": now, "updated_at": now,
    }
    await db.rfqs.insert_one(doc)
    await create_notification(
        product["supplier_id"], "rfq", "Nouvelle demande de devis",
        f"{generate_anonymous_id(u['id'])} a soumis une demande pour {product['name']}", rid)
    return {**doc, "quote_count": 0, "best_price": None}

async def _notify_suppliers_bg(rfq_id: str, buyer_id: str, title: str, sids: list):
    """Notification background — évite le timeout 30s sur 200 fournisseurs (latence africaine)."""
    for sid in sids:
        try:
            await create_notification(sid, "rfq", "Nouvelle demande publique",
                f"{generate_anonymous_id(buyer_id)} cherche : {title}", rfq_id)
        except Exception:
            pass

@router.post("/public", response_model=RFQOut, status_code=201)
async def create_public_rfq(data: PublicRFQCreate, u: dict = Depends(get_current_user),
                             background_tasks: "BackgroundTasks" = None):
    if u.get("user_type") not in ("buyer", "admin"):
        raise HTTPException(403, "Acheteur uniquement")
    db = get_db()
    await _check_text_bypass(db, u["id"], data.title, data.description, data.specifications or "")
    rid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": rid, "rfq_number": _make_rfq_number(), "rfq_type": "public",
        "title": data.title, "description": data.description,
        "category_id": data.category_id, "product_id": None, "product_name": None,
        "supplier_id": None, "supplier_name": None,
        "buyer_id": u["id"], "buyer_name": u.get("anonymous_id") or generate_anonymous_id(u["id"]),
        "quantity": data.quantity, "unit": data.unit,
        "target_price": data.target_price, "delivery_location": data.delivery_location,
        "delivery_deadline": data.delivery_deadline, "specifications": data.specifications,
        "attachments": data.attachments or [],
        "status": "open", "quote_count": 0, "best_price": None,
        "accepted_quotation_id": None, "created_at": now, "updated_at": now,
    }
    await db.rfqs.insert_one(doc)
    sids = [s["id"] async for s in db.users.find(
        {"user_type": "supplier", "account_status": "active"}, {"id": 1, "_id": 0}
    ).limit(200)]
    if background_tasks:
        background_tasks.add_task(_notify_suppliers_bg, rid, u["id"], data.title, sids)
    return {**doc, "quote_count": 0, "best_price": None}

@router.get("/mine")
async def get_my_rfqs(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    u: dict = Depends(get_current_user),
):
    db = get_db()
    flt: dict = {"buyer_id": u["id"]}
    if status:
        flt["status"] = status
    skip = (page - 1) * limit
    rfqs = await db.rfqs.find(flt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.rfqs.count_documents(flt)
    enriched = [await _enrich_rfq(db, r) for r in rfqs]
    return {"items": enriched, "total": total, "page": page, "limit": limit}

@router.get("/public")
async def get_public_rfqs(
    request: Request,
    category_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    u: dict = Depends(get_current_user),
):
    lang = _get_lang(request)
    if u.get("user_type") not in ("supplier", "admin"):
        raise HTTPException(403, "Fournisseur uniquement")
    if u.get("user_type") == "supplier" and not u.get("account_status") == "active":
        raise HTTPException(403, "Compte fournisseur non approuve")
    db = get_db()
    flt: dict = {"rfq_type": "public", "status": "open"}
    if category_id:
        flt["category_id"] = category_id
    skip = (page - 1) * limit
    rfqs = await db.rfqs.find(flt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.rfqs.count_documents(flt)
    enriched = [_anonymize(await _enrich_rfq(db, r), u["id"], lang) for r in rfqs]
    return {"items": enriched, "total": total, "page": page, "limit": limit}

@router.get("")
async def get_rfqs_compat(request: Request, u: dict = Depends(get_current_user)):
    lang = _get_lang(request)
    db = get_db()
    rfqs = await db.rfqs.find(
        {"$or": [{"buyer_id": u["id"]}, {"supplier_id": u["id"]}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [_anonymize(await _enrich_rfq(db, r), u["id"], lang) for r in rfqs]

@router.get("/{rfq_id}", response_model=RFQOut)
async def get_rfq(rfq_id: str, request: Request, u: dict = Depends(get_current_user)):
    lang = _get_lang(request)
    db = get_db()
    rfq = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ non trouvee")
    is_buyer = rfq["buyer_id"] == u["id"]
    is_supplier = rfq.get("supplier_id") == u["id"]
    is_admin = u.get("user_type") == "admin"
    is_public_supplier = (
        rfq.get("rfq_type") == "public" and u.get("user_type") == "supplier" and u.get("account_status") == "active"
    )
    if not (is_buyer or is_supplier or is_admin or is_public_supplier):
        raise HTTPException(403, "Acces refuse")
    return _anonymize(await _enrich_rfq(db, rfq), u["id"], lang)

@router.post("/{rfq_id}/cancel")
async def cancel_rfq(rfq_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    rfq = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ non trouvee")
    if rfq["buyer_id"] != u["id"] and u.get("user_type") != "admin":
        raise HTTPException(403, "Acheteur uniquement")
    if rfq["status"] in ("ordered", "closed"):
        raise HTTPException(400, "RFQ deja finalisee")
    now = datetime.now(timezone.utc).isoformat()
    await db.rfqs.update_one({"id": rfq_id}, {"$set": {"status": "cancelled", "updated_at": now}})
    await db.quotations.update_many(
        {"rfq_id": rfq_id, "status": "pending"},
        {"$set": {"status": "rejected", "updated_at": now}})
    if rfq.get("supplier_id"):
        await create_notification(
            rfq["supplier_id"], "rfq", "Demande annulee",
            f"La demande {rfq.get('rfq_number', rfq_id)} a ete annulee par l'acheteur", rfq_id)
    return {"message": "RFQ annulee"}

@router.post("/{rfq_id}/quote")
async def legacy_quote(rfq_id: str, u: dict = Depends(get_current_user)):
    raise HTTPException(308, detail="Utilisez POST /quotations/{rfq_id}",
        headers={"Location": f"/quotations/{rfq_id}"})

@router.put("/{rfq_id}/accept")
@router.post("/{rfq_id}/accept")
async def legacy_accept(rfq_id: str, u: dict = Depends(get_current_user)):
    raise HTTPException(308, detail="Utilisez POST /quotations/{quotation_id}/accept",
        headers={"Location": f"/quotations/{rfq_id}/accept"})

@router.put("/{rfq_id}/reject")
@router.post("/{rfq_id}/reject")
async def legacy_reject(rfq_id: str, u: dict = Depends(get_current_user)):
    raise HTTPException(308, detail="Utilisez POST /quotations/{quotation_id}/reject",
        headers={"Location": f"/quotations/{rfq_id}/reject"})
