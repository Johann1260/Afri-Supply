from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from typing import Optional, List
from datetime import datetime, timezone

import uuid

from database import get_db
from dependencies import get_current_user
from models.order import OrderCreate, OrderOut
from pydantic import BaseModel as _BM2, Field as _Field
from models.common import TrackingEvent
from services.bypass_service import generate_anonymous_id, localize_anonymous_id

router = APIRouter(prefix="/orders", tags=["orders"])

def _get_lang(request) -> str:
    accept = getattr(request, "headers", {}).get("accept-language", "fr") if request else "fr"
    return accept[:2].lower() if accept else "fr"

def _anonymize_order(order: dict, viewer_id: str, lang: str = "fr") -> dict:
    """Anonymize names in order for the viewer — localized per lang."""
    o = {**order}
    if o.get("buyer_id") != viewer_id:
        o["buyer_name"] = localize_anonymous_id(
            o.get("buyer_name") or generate_anonymous_id(o.get("buyer_id", "")), lang)
    if o.get("supplier_id") != viewer_id:
        o["supplier_name"] = localize_anonymous_id(
            o.get("supplier_name") or generate_anonymous_id(o.get("supplier_id", "")), lang)
    return o

@router.post("", response_model=List[OrderOut])
async def create_orders(data: OrderCreate, u: dict = Depends(get_current_user)):
    """
    DEPRECATED — orders are now created automatically after payment confirmation
    (Stripe webhook or admin Mobile Money confirm). This endpoint is kept only
    for legacy compatibility but requires a confirmed paid transaction to proceed.
    """
    db = get_db()
    # Guard: refuse if buyer has no confirmed paid transaction in the last 10 min
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    paid_tx = await db.payment_transactions.find_one({
        "user_id": u["id"],
        "status": {"$in": ["paid", "completed"]},
        "paid_at": {"$gte": cutoff},
    })
    if not paid_tx:
        raise HTTPException(
            402,
            "Aucun paiement confirmé récent. Passez par /checkout pour payer d'abord."
        )
    raise HTTPException(
        410,
        "Cet endpoint est obsolète. Les commandes sont créées automatiquement après confirmation du paiement."
    )

@router.get("", response_model=List[OrderOut])
async def get_orders(
    request: Request,
    u: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    after_cursor: Optional[str] = None,  # ISO datetime du dernier created_at reçu
):
    lang = _get_lang(request)
    db = get_db()
    q: dict = {"$or": [{"buyer_id": u["id"]}, {"supplier_id": u["id"]}]}
    if after_cursor:
        q["created_at"] = {"$lt": after_cursor}
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [_anonymize_order(o, u["id"], lang) for o in orders]

@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: str, request: Request, u: dict = Depends(get_current_user)):
    lang = _get_lang(request)
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order: raise HTTPException(404, "Commande non trouvée")
    if order["buyer_id"] != u["id"] and order["supplier_id"] != u["id"]:
        raise HTTPException(403, "Accès refusé")
    return _anonymize_order(order, u["id"], lang)

@router.put("/{order_id}/status")
async def update_status(order_id: str, status: str, u: dict = Depends(get_current_user)):
    """Enhanced order workflow: pending → confirmed → processing → quality_check → shipped → in_transit → delivered → completed."""
    VALID_TRANSITIONS = {
        "pending":       ["confirmed", "cancelled"],
        "confirmed":     ["processing", "cancelled"],
        "processing":    ["quality_check", "shipped", "cancelled"],
        "quality_check": ["shipped", "processing"],
        "shipped":       ["in_transit", "delivered"],
        "in_transit":    ["delivered"],
        "delivered":     ["completed", "disputed"],
        "completed":     [],
        "cancelled":     [],
        "disputed":      ["completed", "refunded"],
    }
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order: raise HTTPException(404, "Commande non trouvée")
    current = order.get("status", "pending")
    allowed = VALID_TRANSITIONS.get(current, [])
    if status not in allowed:
        raise HTTPException(400, f"Transition {current} → {status} non autorisée. Autorisés: {allowed}")
    # Supplier-only transitions
    supplier_only = ["confirmed", "processing", "quality_check", "shipped"]
    if status in supplier_only and order["supplier_id"] != u["id"]:
        raise HTTPException(403, "Fournisseur uniquement")
    # Buyer-only transitions
    if status in ["completed", "disputed"] and order["buyer_id"] != u["id"]:
        raise HTTPException(403, "Acheteur uniquement")
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"status": status, "updated_at": now}
    if status == "shipped": update_data["shipped_at"] = now
    if status == "delivered": update_data["delivered_at"] = now
    if status == "completed": update_data["completed_at"] = now
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    # Auto tracking event
    await db.order_tracking.insert_one({
        "id": str(uuid.uuid4()), "order_id": order_id,
        "status": status, "description": f"Statut changé: {current} → {status}",
        "actor_id": u["id"], "created_at": now,
    })
    # Notify other party
    notify_id = order["buyer_id"] if u["id"] == order["supplier_id"] else order["supplier_id"]
    from routers.notifications import create_notification
    await create_notification(notify_id, "order", f"Commande {order['order_number']}",
        f"Statut mis à jour: {status}", order_id)
    return {"message": f"Statut → {status}", "transitions": VALID_TRANSITIONS.get(status, [])}

@router.get("/{order_id}/invoice")
async def get_invoice(order_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order: raise HTTPException(404, "Commande non trouvée")
    if order["buyer_id"] != u["id"]: raise HTTPException(403, "Accès refusé")
    if order.get("payment_status") != "paid": raise HTTPException(400, "Facture disponible uniquement après paiement")
    # Génération PDF simple
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from io import BytesIO
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("<b>FACTURE — AfriSupply</b>", styles["Title"]),
        Spacer(1, 6*mm),
        Paragraph(f"N° : {order['order_number']}", styles["Normal"]),
        Paragraph(f"Date : {order['created_at'][:10]}", styles["Normal"]),
        Paragraph(f"Acheteur : {order['buyer_name']}", styles["Normal"]),
        Paragraph(f"Fournisseur : {order['supplier_name']}", styles["Normal"]),
        Spacer(1, 6*mm),
    ]
    data = [["Produit", "Qté", "Prix unit.", "Sous-total"]]
    for item in order.get("items", []):
        data.append([item["product_name"], str(item["quantity"]), f"{item['price']:,.0f} XAF", f"{item['subtotal']:,.0f} XAF"])
    data.append(["", "", "TOTAL", f"{order['total']:,.0f} XAF"])
    t = Table(data, colWidths=[90*mm, 20*mm, 30*mm, 30*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), colors.HexColor("#034168")),
        ("TEXTCOLOR",(0,0),(-1,0), colors.white),
        ("FONTNAME",(0,0),(-1,0), "Helvetica-Bold"),
        ("GRID",(0,0),(-1,-1),0.5, colors.HexColor("#CCC")),
        ("FONTNAME",(0,-1),(-1,-1), "Helvetica-Bold"),
        ("BACKGROUND",(0,-1),(-1,-1), colors.HexColor("#F0F4F8")),
    ]))
    story.append(t)
    doc.build(story)
    return Response(content=buf.getvalue(), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Facture_{order["order_number"]}.pdf"'})

@router.get("/{order_id}/tracking")
async def get_tracking(order_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "buyer_id": 1, "supplier_id": 1})
    if not order:
        raise HTTPException(404, "Commande non trouvée")
    if order["buyer_id"] != u["id"] and order["supplier_id"] != u["id"]:
        raise HTTPException(403, "Accès refusé")
    events = await db.order_tracking.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    return events

@router.post("/{order_id}/tracking")
async def add_tracking(order_id: str, data: TrackingEvent, u: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order: raise HTTPException(404, "Commande non trouvée")
    if order["supplier_id"] != u["id"]: raise HTTPException(403, "Accès refusé")
    event = {"id": str(uuid.uuid4()), "order_id": order_id, **data.model_dump(exclude_none=True), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.order_tracking.insert_one(event)
    return event

class _DeliveryFeeUpdate(_BM2):
    delivery_fee: float = _Field(..., ge=0, le=500_000, description="Frais livraison XAF (max 500 000)")

@router.put("/{order_id}/delivery-fee")
async def set_delivery_fee(order_id: str, data: _DeliveryFeeUpdate, u: dict = Depends(get_current_user)):
    """Supplier sets delivery fee. Recalculates total = subtotal + delivery_fee."""
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order: raise HTTPException(404, "Commande non trouvée")
    if order["supplier_id"] != u["id"]: raise HTTPException(403, "Fournisseur uniquement")
    if order.get("status") not in ("confirmed", "processing"):
        raise HTTPException(400, "Frais modifiables avant expédition uniquement")
    fee = data.delivery_fee
    new_total = order.get("subtotal", 0) + fee
    await db.orders.update_one({"id": order_id}, {"$set": {
        "delivery_fee": fee, "total": new_total,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }})
    from routers.notifications import create_notification
    await create_notification(order["buyer_id"], "order",
        f"Frais de livraison — {order['order_number']}",
        f"Le fournisseur a fixé les frais de livraison à {fee:,.0f} XAF", order_id)
    return {"message": "Frais mis à jour", "delivery_fee": fee, "total": new_total}
