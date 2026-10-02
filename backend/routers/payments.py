from fastapi import APIRouter, Depends, HTTPException, Request

from datetime import datetime, timedelta, timezone
from database import get_db
from services.admin_log_service import log_action as _log
from dependencies import get_current_user, require_admin
from config import get_settings
from models.payment import CheckoutRequest, MobileMoneyRequest
import stripe, uuid
from pymongo import ReturnDocument
from services.bypass_service import generate_anonymous_id

from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(tags=["payments"])
settings = get_settings()
stripe.api_key = settings.stripe_api_key
_limiter = Limiter(key_func=get_remote_address)

async def _cart_total(user_id: str) -> float:
    """M1: requête $in unique au lieu de N find_one séquentiels."""
    db = get_db()
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0}) or {}
    items = cart.get("items", [])
    if not items:
        return 0.0
    ids = [i["product_id"] for i in items]
    prods = {p["id"]: p async for p in db.products.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "price": 1})}
    return sum(prods[i["product_id"]]["price"] * i["quantity"] for i in items if i["product_id"] in prods)

async def _confirm_payment(user_id: str, method: str):
    db = get_db()
    await db.orders.update_many(
        {"buyer_id": user_id, "payment_status": "pending", "payment_method": method},
        {"$set": {"payment_status": "paid", "status": "confirmed"}}
    )
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})

async def _create_orders_from_cart(user_id: str, method: str, extra: dict | None = None) -> list[str]:
    """Create orders from cart + mark paid + clear cart — only called after confirmed payment.
    Returns list of created order IDs. Raises ValueError on stock issues (logged, not re-raised)."""
    db = get_db()
    extra = extra or {}
    # Extraire le snapshot prix (verrouillé au moment du paiement Stripe)
    snapshot = extra.pop("cart_snapshot", None) or []
    price_lock = {item["product_id"]: item["locked_price"] for item in snapshot if "locked_price" in item} if snapshot else None
    user = await db.users.find_one({"id": user_id}, {"_id": 0}) or {}
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart or not cart.get("items"):
        return []

    # ── Batch-fetch all products in ONE query (no N+1) ───────────────────────
    cart_items = cart["items"]
    pids = [i["product_id"] for i in cart_items]
    qty_map = {i["product_id"]: i["quantity"] for i in cart_items}
    prods_map: dict = {p["id"]: p async for p in db.products.find({"id": {"$in": pids}}, {"_id": 0})}

    # ── Atomic stock reservation: find_and_update with $inc, check result ───
    supplier_items: dict = {}
    stock_errors: list[str] = []
    reserved: list[tuple[str, int]] = []  # for rollback if needed

    for product_id, quantity in qty_map.items():
        # Atomically decrement — only if stock_quantity >= quantity
        result = await db.products.find_one_and_update(
            {"id": product_id, "stock_quantity": {"$gte": quantity}},
            {"$inc": {"stock_quantity": -quantity}},
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        if not result:
            p = prods_map.get(product_id)
            err_msg = f"{p['name'] if p else product_id}: stock insuffisant (demandé: {quantity})"
            stock_errors.append(err_msg)
            continue  # skip this item, others proceed
        reserved.append((product_id, quantity))
        sid = result["supplier_id"]
        # Utiliser le prix verrouillé si snapshot disponible (évite divergence Stripe↔ordre)
        locked_price = price_lock.get(product_id, result["price"]) if price_lock else result["price"]
        supplier_items.setdefault(sid, []).append({
            "product_id": result["id"], "product_name": result["name"],
            "product_image": result.get("images", [None])[0],
            "quantity": quantity, "price": locked_price,
            "unit": result.get("unit", ""), "subtotal": locked_price * quantity
        })

    now = datetime.now(timezone.utc).isoformat()
    order_ids: list[str] = []
    from routers.notifications import create_notification
    from services.email_service import send_email

    # B4: Notifier l'acheteur si des articles étaient en rupture de stock
    if stock_errors:
        try:
            await create_notification(
                user_id, "order",
                "⚠️ Stock insuffisant",
                f"Articles non disponibles au moment du paiement : {'; '.join(stock_errors)}. "
                f"Contactez le support pour un remboursement partiel.",
                None
            )
        except Exception:
            pass  # notification non bloquante

    for sid, items in supplier_items.items():
        sup = await db.users.find_one({"id": sid}, {"_id": 0}) or {}
        subtotal = sum(i["subtotal"] for i in items)
        oid = str(uuid.uuid4())
        onum = f"AS-{datetime.now().strftime('%Y%m%d')}-{oid[:8].upper()}"
        trade_assurance = bool(extra.get("trade_assurance", False))

        await db.orders.insert_one({
            "id": oid, "order_number": onum,
            "buyer_id": user_id, "buyer_name": generate_anonymous_id(user_id),
            "supplier_id": sid, "supplier_name": generate_anonymous_id(sid),
            "items": items, "subtotal": subtotal, "total": subtotal,
            "status": "confirmed", "payment_status": "paid",
            "payment_method": method, "created_at": now,
            "shipping_address": extra.get("shipping_address", ""),
            "shipping_city": extra.get("shipping_city", ""),
            "shipping_country": extra.get("shipping_country", ""),
            "notes": extra.get("notes", ""),
            "delivery_fee": 0,
            "trade_assurance": trade_assurance,
            "ta_status": None,
        })

        # ── Stock already decremented atomically above (find_one_and_update) ──

        # ── Auto-activer Trade Assurance si demandé ──────────────────────────
        if trade_assurance:
            hold_days = settings.escrow_hold_days
            from datetime import timedelta
            hold_until = (datetime.now(timezone.utc) + timedelta(days=hold_days)).isoformat()
            await db.trade_assurance.insert_one({
                "id": str(uuid.uuid4()), "order_id": oid,
                "buyer_id": user_id, "supplier_id": sid,
                "amount": subtotal, "currency": "XAF",
                "status": "held", "buyer_confirmed": False,
                "hold_until": hold_until, "created_at": now,
            })
            await db.orders.update_one({"id": oid}, {"$set": {"ta_status": "held"}})

        # ── Notifier le fournisseur ──────────────────────────────────────────
        try:
            await create_notification(
                sid, "order",
                f"Nouvelle commande {onum}",
                f"{user.get('full_name','Un acheteur')} vient de passer une commande de {subtotal:,.0f} XAF",
                oid
            )
            if sup.get("email"):
                await send_email(
                    sup["email"],
                    f"Nouvelle commande {onum} — AfriSupply",
                    f"<p>Bonjour {sup.get('full_name','')},</p>"
                    f"<p>Vous avez reçu une nouvelle commande <b>{onum}</b> "
                    f"d'un montant de <b>{subtotal:,.0f} XAF</b>.</p>"
                    f"<p>Connectez-vous à votre tableau de bord pour la traiter.</p>"
                )
        except Exception:
            pass  # notifications non bloquantes

        order_ids.append(oid)

    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})
    return order_ids

@router.post("/checkout/session")
@_limiter.limit("10/minute")
async def create_session(data: CheckoutRequest, request: Request, u: dict = Depends(get_current_user)):
    if not settings.stripe_api_key:
        raise HTTPException(503, "Paiement par carte non disponible")
    total = await _cart_total(u["id"])
    if total <= 0: raise HTTPException(400, "Panier vide")
    total_usd = round(total / settings.xaf_usd_rate, 2)
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{"price_data": {"currency": "usd",
                "product_data": {"name": "AfriSupply Order"},
                "unit_amount": int(total_usd * 100)}, "quantity": 1}],
            mode="payment",
            success_url=f"{data.origin_url}/checkout?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{data.origin_url}/cart",
            metadata={"user_id": u["id"], "cart_total_xaf": str(total)}
        )
    except stripe.error.StripeError as e:
        raise HTTPException(502, f"Erreur paiement: {str(e)[:200]}")
    # Snapshot panier : verrouille les prix au moment du paiement (évite divergence si prix change avant webhook)
    _cart_doc = await db.carts.find_one({"user_id": u["id"]}, {"_id": 0}) or {}
    _cart_items = _cart_doc.get("items", [])
    _pids = [i["product_id"] for i in _cart_items]
    _prods_snap = {p["id"]: p async for p in db.products.find(
        {"id": {"$in": _pids}}, {"_id": 0, "id": 1, "price": 1, "name": 1, "unit": 1}
    )}
    cart_snapshot = [
        {**i, "locked_price": _prods_snap[i["product_id"]]["price"],
               "locked_name":  _prods_snap[i["product_id"]].get("name", "")}
        for i in _cart_items if i["product_id"] in _prods_snap
    ]
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()), "session_id": session.id, "user_id": u["id"],
        "amount_usd": total_usd, "amount_xaf": total, "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "shipping_address": data.shipping_address, "shipping_city": data.shipping_city,
        "shipping_country": data.shipping_country, "notes": data.notes,
        "trade_assurance": getattr(data, "trade_assurance", False),
        "cart_snapshot": cart_snapshot,  # prix verrouillés au moment du paiement
        "order_ids": [],
    })
    return {"url": session.url, "session_id": session.id}

@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    # D'abord, chercher dans nos transactions (plus rapide, contient order_ids)
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(502, f"Erreur vérification: {str(e)[:200]}")
    return {
        "status": session.status,
        "payment_status": session.payment_status,
        "order_ids": tx.get("order_ids", []) if tx else [],
    }

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    if not settings.stripe_webhook_secret:
        raise HTTPException(500, "Webhook secret non configuré")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(400, "Signature invalide")
    if event["type"] == "checkout.session.completed":
        s = event["data"]["object"]
        user_id = s.get("metadata", {}).get("user_id")
        if user_id:
            db = get_db()
            # Idempotent: only first transition initiated -> paid creates the orders
            res = await db.payment_transactions.update_one(
                {"session_id": s.get("id",""), "status": {"$ne": "paid"}},
                {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}}
            )
            if res.modified_count == 1:
                tx_rec = await db.payment_transactions.find_one({"session_id": s.get("id","")}, {"_id": 0})
                extra = {k: tx_rec.get(k) for k in ("shipping_address","shipping_city","shipping_country","notes","trade_assurance","cart_snapshot")} if tx_rec else {}
                order_ids = await _create_orders_from_cart(user_id, "stripe", extra)
                # Stocker les order_ids pour que /checkout/status puisse les retourner
                await db.payment_transactions.update_one(
                    {"session_id": s.get("id","")},
                    {"$set": {"order_ids": order_ids}}
                )
    return {"status": "ok"}

@router.post("/checkout/mobile-money")
@_limiter.limit("5/minute")
async def mobile_money(data: MobileMoneyRequest, request: Request, u: dict = Depends(get_current_user)):
    total = await _cart_total(u["id"])
    if total <= 0: raise HTTPException(400, "Panier vide")
    db = get_db()
    # Idempotence : éviter les doubles transactions sur réseau instable (Afrique)
    existing = await db.payment_transactions.find_one(
        {"user_id": u["id"], "status": "pending", "payment_type": "mobile_money"},
        {"_id": 0}
    )
    if existing:
        return existing  # Retourne la transaction existante sans créer de doublon
    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    instructions = {
        "MTN": f"Composez *126# et validez {total:,.0f} XAF",
        "Orange": f"Composez #150*1# et validez {total:,.0f} XAF",
        "Airtel": f"Composez *500# et validez {total:,.0f} XAF",
    }
    await db.payment_transactions.insert_one({
        "id": tid, "user_id": u["id"], "amount": total, "currency": "XAF",
        "phone_number": data.phone_number, "network": data.network,
        "status": "pending", "payment_type": "mobile_money", "created_at": now,
        "shipping_address": data.shipping_address, "shipping_city": data.shipping_city,
        "shipping_country": data.shipping_country, "notes": data.notes,
    })
    return {"transaction_id": tid, "status": "pending", "amount": total, "currency": "XAF",
        "phone_number": data.phone_number, "network": data.network,
        "payment_instruction": instructions.get(data.network, f"Validez {total:,.0f} XAF"),
        "created_at": now}

@router.post("/checkout/mobile-money/{transaction_id}/confirm")
async def confirm_mobile_money(transaction_id: str, admin: dict = Depends(require_admin)):
    """Admin-only: validates a Mobile Money payment after manual operator check.
    Idempotent: only first transition pending -> completed triggers order creation + email."""
    from services.email_service import send_email, tpl_momo_confirmed
    db = get_db()
    tx = await db.payment_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not tx: raise HTTPException(404, "Transaction non trouvée")
    if tx.get("payment_type") != "mobile_money": raise HTTPException(400, "Type de transaction invalide")
    res = await db.payment_transactions.update_one(
        {"id": transaction_id, "status": "pending"},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat(), "confirmed_by": admin["id"]}}
    )
    if res.modified_count == 1:
        extra = {k: tx.get(k) for k in ("shipping_address","shipping_city","shipping_country","notes","trade_assurance","cart_snapshot")}
        order_ids = await _create_orders_from_cart(tx["user_id"], "mobile_money", extra)
        await db.payment_transactions.update_one({"id": transaction_id}, {"$set": {"order_ids": order_ids}})
        # Notify buyer (best-effort, never block payment confirmation)
        try:
            buyer = await db.users.find_one({"id": tx["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
            if buyer and buyer.get("email"):
                await send_email(
                    buyer["email"],
                    "Paiement confirmé — AfriSupply",
                    tpl_momo_confirmed(buyer.get("full_name", ""), tx.get("amount", 0),
                                       tx.get("network", "Mobile Money"), transaction_id)
                )
        except Exception:
            pass
    await _log(admin["id"], admin.get("full_name","Admin"), "confirm_momo",
               f"Confirmation MoMo transaction {transaction_id}", "payment", transaction_id)
    return {"message": "Paiement confirmé", "status": "completed"}

# ── Trade Assurance (Escrow) ─────────────────────────────────────────────────
from models.trade_assurance import TradeAssuranceCreate, DisputeCreate

@router.post("/trade-assurance")
async def create_trade_assurance(data: TradeAssuranceCreate, u: dict = Depends(get_current_user)):
    """Hold payment in escrow until buyer confirms delivery."""
    db = get_db()
    order = await db.orders.find_one({"id": data.order_id, "buyer_id": u["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Commande non trouvée")
    if order.get("payment_status") != "paid":
        raise HTTPException(400, "Commande non payée")
    existing = await db.trade_assurance.find_one({"order_id": data.order_id})
    if existing:
        raise HTTPException(400, "Trade Assurance déjà activée")
    hold_days = settings.escrow_hold_days
    now = datetime.now(timezone.utc)
    ta_doc = {
        "id": str(uuid.uuid4()), "order_id": data.order_id,
        "buyer_id": u["id"], "supplier_id": order["supplier_id"],
        "amount": order["total"], "currency": "XAF",
        "status": "held", "buyer_confirmed": False,
        "hold_until": (now + timedelta(days=hold_days)).isoformat(),
        "created_at": now.isoformat(),
    }
    await db.trade_assurance.insert_one(ta_doc)
    await db.orders.update_one({"id": data.order_id}, {"$set": {"trade_assurance": True, "ta_status": "held"}})
    return ta_doc

@router.post("/trade-assurance/{ta_id}/confirm")
async def confirm_delivery(ta_id: str, u: dict = Depends(get_current_user)):
    """Buyer confirms delivery → release funds to supplier."""
    db = get_db()
    ta = await db.trade_assurance.find_one({"id": ta_id}, {"_id": 0})
    if not ta:
        raise HTTPException(404, "Trade Assurance non trouvée")
    if ta["buyer_id"] != u["id"]:
        raise HTTPException(403, "Acheteur uniquement")
    if ta["status"] != "held":
        raise HTTPException(400, f"Statut actuel: {ta['status']}")
    now = datetime.now(timezone.utc).isoformat()
    await db.trade_assurance.update_one({"id": ta_id}, {"$set": {
        "status": "released", "buyer_confirmed": True, "released_at": now
    }})
    await db.orders.update_one({"id": ta["order_id"]}, {"$set": {
        "ta_status": "released",
        "status": "completed",   # ordre complété quand les fonds sont libérés
        "completed_at": now,
    }})
    # Notifier le fournisseur que ses fonds sont disponibles
    try:
        from routers.notifications import create_notification
        await create_notification(
            ta["supplier_id"], "order",
            "Fonds libérés — paiement reçu",
            "L'acheteur a confirmé la livraison. Vos fonds ont été libérés.",
            ta["order_id"]
        )
    except Exception:
        pass
    return {"message": "Fonds libérés au fournisseur", "released_at": now}

@router.post("/trade-assurance/{ta_id}/dispute")
async def open_dispute(ta_id: str, data: DisputeCreate, u: dict = Depends(get_current_user)):
    """Buyer opens a dispute before release."""
    db = get_db()
    ta = await db.trade_assurance.find_one({"id": ta_id}, {"_id": 0})
    if not ta:
        raise HTTPException(404, "Trade Assurance non trouvée")
    if ta["buyer_id"] != u["id"]:
        raise HTTPException(403, "Acheteur uniquement")
    if ta["status"] != "held":
        raise HTTPException(400, "Litige impossible après libération")
    now = datetime.now(timezone.utc).isoformat()
    await db.trade_assurance.update_one({"id": ta_id}, {"$set": {"status": "disputed"}})
    await db.disputes.insert_one({
        "id": str(uuid.uuid4()), "ta_id": ta_id, "order_id": ta["order_id"],
        "buyer_id": u["id"], "supplier_id": ta["supplier_id"],
        "reason": data.reason, "description": data.description,
        "status": "open", "created_at": now,
    })
    await db.orders.update_one({"id": ta["order_id"]}, {"$set": {"ta_status": "disputed"}})
    return {"message": "Litige ouvert — un administrateur va traiter votre demande"}

@router.get("/trade-assurance/{order_id}")
async def get_trade_assurance(order_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    ta = await db.trade_assurance.find_one({"order_id": order_id}, {"_id": 0})
    if not ta:
        raise HTTPException(404, "Pas de Trade Assurance")
    if ta["buyer_id"] != u["id"] and ta["supplier_id"] != u["id"]:
        raise HTTPException(403, "Accès refusé")
    return ta

@router.post("/trade-assurance/release-expired")
async def release_expired_escrows(_: dict = Depends(require_admin)):
    """Libère automatiquement les escrows dont hold_until est dépassé.
    Appelé par un cron toutes les 6h ou manuellement par un admin."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    expired = await db.trade_assurance.find(
        {"status": "held", "hold_until": {"$lt": now}}, {"_id": 0}
    ).to_list(500)

    released_ids = []
    for ta in expired:
        await db.trade_assurance.update_one(
            {"id": ta["id"]},
            {"$set": {"status": "released", "released_at": now, "auto_released": True}}
        )
        await db.orders.update_one(
            {"id": ta["order_id"]},
            {"$set": {"ta_status": "released", "status": "completed", "completed_at": now}}
        )
        # Notifier acheteur et fournisseur
        try:
            from routers.notifications import create_notification
            await create_notification(
                ta["buyer_id"], "order",
                "Protection acheteur expirée",
                "Les fonds ont été libérés automatiquement au fournisseur (délai dépassé).",
                ta["order_id"]
            )
            await create_notification(
                ta["supplier_id"], "order",
                "Fonds libérés",
                "Le délai de protection acheteur est expiré — vos fonds ont été libérés.",
                ta["order_id"]
            )
        except Exception:
            pass
        released_ids.append(ta["id"])

    return {"released": released_ids, "count": len(released_ids)}
