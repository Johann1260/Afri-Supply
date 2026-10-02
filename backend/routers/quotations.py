from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import get_db
from dependencies import get_current_user
from models.rfq import QuotationCreate, QuotationOut
from routers.notifications import create_notification
from services.bypass_service import generate_anonymous_id, localize_anonymous_id
from services.email_service import send_email

router = APIRouter(prefix="/quotations", tags=["quotations"])

def _get_lang(request) -> str:
    accept = getattr(request, "headers", {}).get("accept-language", "fr") if request else "fr"
    return accept[:2].lower() if accept else "fr"

# ── helpers ──────────────────────────────────────────────────────────────────

async def _get_rfq_or_404(db, rfq_id: str) -> dict:
    rfq = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ non trouvée")
    return rfq

def _mask_supplier(q: dict, viewer_id: str, lang: str = "fr") -> dict:
    """Masque supplier_id/supplier_name sauf si c'est le viewer — localisé."""
    q = dict(q)
    if q.get("supplier_id") != viewer_id:
        q["supplier_name"] = localize_anonymous_id(
            q.get("supplier_name") or generate_anonymous_id(q.get("supplier_id", "")), lang)
        q.pop("supplier_id", None)
    return q

# ── POST /quotations/{rfq_id} — fournisseur soumet un devis ──────────────────

@router.post("/{rfq_id}", response_model=QuotationOut, status_code=201)
async def submit_quotation(
    rfq_id: str,
    data: QuotationCreate,
    u: dict = Depends(get_current_user),
):
    if u.get("user_type") != "supplier":
        raise HTTPException(403, "Fournisseur uniquement")
    if u.get("account_status") != "active":
        raise HTTPException(403, "Compte non approuvé")

    db = get_db()
    rfq = await _get_rfq_or_404(db, rfq_id)

    if rfq["status"] not in ("open",):
        raise HTTPException(400, f"RFQ non ouverte (statut: {rfq['status']})")

    # RFQ privé → seul le fournisseur désigné peut répondre
    if rfq.get("rfq_type") == "private" and rfq.get("supplier_id") != u["id"]:
        raise HTTPException(403, "Vous n'êtes pas le fournisseur désigné")

    # Vérifier doublon
    existing = await db.quotations.find_one(
        {"rfq_id": rfq_id, "supplier_id": u["id"], "status": {"$ne": "rejected"}},
        {"_id": 0, "id": 1},
    )
    if existing:
        raise HTTPException(409, "Vous avez déjà soumis un devis pour cette RFQ")

    qid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    total_price = round(data.unit_price * data.quantity, 2)

    doc = {
        "id": qid,
        "rfq_id": rfq_id,
        "supplier_id": u["id"],
        "supplier_name": generate_anonymous_id(u["id"]),
        "unit_price": data.unit_price,
        "total_price": total_price,
        "quantity": data.quantity,
        "currency": data.currency,
        "delivery_time_days": data.delivery_time_days,
        "validity_days": data.validity_days,
        "moq": data.moq,
        "conditions": data.conditions,
        "notes": data.notes,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    await db.quotations.insert_one(doc)

    # Mettre à jour RFQ : quote_count + best_price
    agg = await db.quotations.aggregate([
        {"$match": {"rfq_id": rfq_id, "status": {"$ne": "rejected"}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "best": {"$min": "$unit_price"}}},
    ]).to_list(1)
    if agg:
        await db.rfqs.update_one(
            {"id": rfq_id},
            {"$set": {
                "quote_count": agg[0]["count"],
                "best_price": agg[0]["best"],
                "status": "comparing",
                "updated_at": now,
            }},
        )

    # Notifier l'acheteur
    rfq_label = rfq.get("rfq_number") or rfq.get("title") or rfq_id
    await create_notification(
        rfq["buyer_id"], "quotation",
        "Nouveau devis reçu",
        f"{generate_anonymous_id(u['id'])} a soumis un devis de {total_price:,.0f} {data.currency}",
        rfq_id,
    )
    # Email acheteur (best-effort)
    buyer = await db.users.find_one({"id": rfq["buyer_id"]}, {"_id": 0, "email": 1})
    if buyer and buyer.get("email"):
        try:
            await send_email(
                buyer["email"],
                f"Nouveau devis pour {rfq_label} — AfriSupply",
                f"<p>Vous avez reçu un nouveau devis de <strong>{generate_anonymous_id(u['id'])}</strong>.</p>"
                f"<p>Prix unitaire : <strong>{data.unit_price:,.0f} {data.currency}</strong> | "
                f"Délai : {data.delivery_time_days} jours</p>"
                f"<p><a href='https://afrisupply.com/rfq/{rfq_id}'>Voir les devis</a></p>",
            )
        except Exception:
            pass

    return doc

# ── GET /quotations/rfq/{rfq_id} — lister les devis d'une RFQ ────────────────

@router.get("/rfq/{rfq_id}")
async def list_quotations(
    rfq_id: str,
    request: Request,
    u: dict = Depends(get_current_user),
):
    lang = _get_lang(request)
    db = get_db()
    rfq = await _get_rfq_or_404(db, rfq_id)

    is_buyer = rfq["buyer_id"] == u["id"]
    is_supplier = u.get("user_type") == "supplier" and u.get("account_status") == "active"
    is_admin = u.get("user_type") == "admin"

    if not (is_buyer or is_admin):
        if not is_supplier:
            raise HTTPException(403, "Accès refusé")
        quotes = await db.quotations.find(
            {"rfq_id": rfq_id, "supplier_id": u["id"]},
            {"_id": 0},
        ).sort("created_at", 1).to_list(1)
        return quotes

    quotes = await db.quotations.find(
        {"rfq_id": rfq_id},
        {"_id": 0},
    ).sort("unit_price", 1).to_list(200)

    return [_mask_supplier(q, u["id"], lang) for q in quotes]

# ── POST /quotations/{quotation_id}/accept — acheteur accepte un devis ───────

@router.post("/{quotation_id}/accept")
async def accept_quotation(
    quotation_id: str,
    u: dict = Depends(get_current_user),
):
    if u.get("user_type") not in ("buyer", "admin"):
        raise HTTPException(403, "Acheteur uniquement")

    db = get_db()
    quote = await db.quotations.find_one({"id": quotation_id}, {"_id": 0})
    if not quote:
        raise HTTPException(404, "Devis non trouvé")

    rfq = await _get_rfq_or_404(db, quote["rfq_id"])
    if rfq["buyer_id"] != u["id"] and u.get("user_type") != "admin":
        raise HTTPException(403, "Acheteur uniquement")
    if rfq["status"] not in ("comparing", "open"):
        raise HTTPException(400, f"RFQ non comparable (statut: {rfq['status']})")

    now = datetime.now(timezone.utc).isoformat()

    # Accepter ce devis, rejeter les autres
    await db.quotations.update_one(
        {"id": quotation_id},
        {"$set": {"status": "accepted", "updated_at": now}},
    )
    await db.quotations.update_many(
        {"rfq_id": rfq["id"], "id": {"$ne": quotation_id}, "status": "pending"},
        {"$set": {"status": "rejected", "updated_at": now}},
    )

    # Créer la commande directement depuis le devis accepté
    product = None
    if rfq.get("product_id"):
        product = await db.products.find_one({"id": rfq["product_id"]}, {"_id": 0})

    order_id = str(uuid.uuid4())
    order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{order_id[:8].upper()}"
    unit_price = quote["unit_price"]
    qty = quote["quantity"]

    order_doc = {
        "id": order_id,
        "order_number": order_number,
        "source": "rfq",
        "rfq_id": rfq["id"],
        "quotation_id": quotation_id,
        "buyer_id": rfq["buyer_id"],
        "buyer_name": generate_anonymous_id(rfq["buyer_id"]),
        "supplier_id": quote["supplier_id"],
        "supplier_name": generate_anonymous_id(quote["supplier_id"]),
        "product_id": rfq.get("product_id"),
        "product_name": rfq.get("product_name") or rfq.get("title", ""),
        "quantity": qty,
        "unit_price": unit_price,
        "subtotal": quote["total_price"],
        "total": quote["total_price"],
        "currency": quote.get("currency", "XAF"),
        "delivery_location": rfq.get("delivery_location", ""),
        "delivery_deadline": rfq.get("delivery_deadline"),
        "status": "pending_payment",
        "payment_status": "unpaid",
        "ta_status": None,
        "tracking_number": None,
        "tracking_url": None,
        "items": [{
            "product_id": rfq.get("product_id"),
            "product_name": rfq.get("product_name") or rfq.get("title", ""),
            "quantity": qty,
            "unit_price": unit_price,
            "subtotal": quote["total_price"],
            "image_url": product.get("images", [None])[0] if product else None,
        }],
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(order_doc)

    # Fermer la RFQ
    await db.rfqs.update_one(
        {"id": rfq["id"]},
        {"$set": {
            "status": "accepted",
            "accepted_quotation_id": quotation_id,
            "updated_at": now,
        }},
    )

    # Notifier le fournisseur retenu
    await create_notification(
        quote["supplier_id"], "quotation",
        "Votre devis a été accepté !",
        f"{generate_anonymous_id(rfq['buyer_id'])} a accepté votre devis — commande créée",
        order_id,
    )
    # Notifier les autres fournisseurs (devis rejetés)
    rejected_quotes = await db.quotations.find(
        {"rfq_id": rfq["id"], "id": {"$ne": quotation_id}, "status": "rejected"},
        {"_id": 0, "supplier_id": 1},
    ).to_list(100)
    for rq in rejected_quotes:
        await create_notification(
            rq["supplier_id"], "quotation",
            "Devis non retenu",
            f"L'acheteur a choisi un autre fournisseur pour cette demande",
            rfq["id"],
        )

    return {"message": "Devis accepté", "order_id": order_id, "order_number": order_number}

# ── POST /quotations/{quotation_id}/reject — acheteur rejette un devis ────────

@router.post("/{quotation_id}/reject")
async def reject_quotation(
    quotation_id: str,
    reason: Optional[str] = Body(None, embed=True),
    u: dict = Depends(get_current_user),
):
    if u.get("user_type") not in ("buyer", "admin"):
        raise HTTPException(403, "Acheteur uniquement")

    db = get_db()
    quote = await db.quotations.find_one({"id": quotation_id}, {"_id": 0})
    if not quote:
        raise HTTPException(404, "Devis non trouvé")

    rfq = await _get_rfq_or_404(db, quote["rfq_id"])
    if rfq["buyer_id"] != u["id"] and u.get("user_type") != "admin":
        raise HTTPException(403, "Acheteur uniquement")

    now = datetime.now(timezone.utc).isoformat()
    await db.quotations.update_one(
        {"id": quotation_id},
        {"$set": {"status": "rejected", "reject_reason": reason, "updated_at": now}},
    )
    await create_notification(
        quote["supplier_id"], "quotation",
        "Devis refusé",
        f"L'acheteur n'a pas retenu votre devis{f' : {reason}' if reason else ''}",
        rfq["id"],
    )
    return {"message": "Devis rejeté"}

# ── GET /quotations/my — fournisseur voit ses propres devis ──────────────────

@router.get("/my")
async def my_quotations(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    u: dict = Depends(get_current_user),
):
    if u.get("user_type") != "supplier":
        raise HTTPException(403, "Fournisseur uniquement")

    db = get_db()
    flt: dict = {"supplier_id": u["id"]}
    if status:
        flt["status"] = status
    skip = (page - 1) * limit
    quotes = (
        await db.quotations.find(flt, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.quotations.count_documents(flt)

    # Enrichir avec info RFQ
    rfq_ids = list({q["rfq_id"] for q in quotes})
    rfqs = {r["id"]: r async for r in db.rfqs.find(
        {"id": {"$in": rfq_ids}}, {"_id": 0, "id": 1, "rfq_number": 1, "title": 1, "product_name": 1, "status": 1}
    )}
    for q in quotes:
        rfq_data = rfqs.get(q["rfq_id"], {})
        q["rfq_number"] = rfq_data.get("rfq_number")
        q["rfq_title"] = rfq_data.get("title") or rfq_data.get("product_name")
        q["rfq_status"] = rfq_data.get("status")

    return {"items": quotes, "total": total, "page": page, "limit": limit}
