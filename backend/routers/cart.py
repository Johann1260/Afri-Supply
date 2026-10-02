from fastapi import APIRouter, Depends, HTTPException
from services.bypass_service import generate_anonymous_id

from database import get_db
from dependencies import get_current_user
from models.payment import CartItemAdd
import uuid

router = APIRouter(prefix="/cart", tags=["cart"])

async def _get_enriched_cart(user_id: str):
    db = get_db()
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart:
        cart = {"id": str(uuid.uuid4()), "user_id": user_id, "items": []}
        try:
            await db.carts.insert_one(cart)
        except Exception:  # DuplicateKeyError si race entre onglets simultanés
            cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0}) or cart
    items = cart.get("items", [])
    if not items:
        return {"id": cart["id"], "user_id": user_id, "items": [], "total": 0.0, "item_count": 0}
    pids = [i["product_id"] for i in items]
    prods = {p["id"]: p async for p in db.products.find({"id": {"$in": pids}}, {"_id": 0})}
    sids = list({p.get("supplier_id") for p in prods.values() if p.get("supplier_id")})
    sups = {s["id"]: s async for s in db.users.find({"id": {"$in": sids}}, {"_id": 0})}
    enriched, total = [], 0.0
    for item in items:
        p = prods.get(item["product_id"])
        if not p: continue
        sup = sups.get(p.get("supplier_id"), {})
        sub = p["price"] * item["quantity"]
        total += sub
        enriched.append({"product_id": item["product_id"], "product_name": p["name"],
            "product_image": p["images"][0] if p.get("images") else None,
            "supplier_id": p["supplier_id"], "supplier_name": generate_anonymous_id(p["supplier_id"]),
            "price": p["price"], "quantity": item["quantity"], "unit": p["unit"], "subtotal": sub})
    return {"id": cart["id"], "user_id": user_id, "items": enriched, "total": total, "item_count": len(enriched)}

@router.get("")
async def get_cart(u: dict = Depends(get_current_user)):
    return await _get_enriched_cart(u["id"])

@router.post("/items")
async def add_item(item: CartItemAdd, u: dict = Depends(get_current_user)):
    db = get_db()
    product = await db.products.find_one(
        {"id": item.product_id, "is_available": True, "is_approved": True}, {"_id": 0}
    )
    if not product:
        raise HTTPException(404, "Produit non trouvé ou indisponible")
    min_qty = product.get("min_order_quantity", 1)
    if item.quantity < min_qty:
        raise HTTPException(400, f"Quantité minimum requise : {min_qty} {product.get('unit', 'unité')}")
    # Upsert cart si n'existe pas encore
    await db.carts.update_one(
        {"user_id": u["id"]},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "user_id": u["id"], "items": []}},
        upsert=True
    )
    # Atomique: $inc si item existe déjà
    result = await db.carts.update_one(
        {"user_id": u["id"], "items.product_id": item.product_id},
        {"$inc": {"items.$.quantity": item.quantity}}
    )
    if result.matched_count == 0:
        # Conditionner le push sur l'absence de l'item pour éviter la race condition
        await db.carts.update_one(
            {"user_id": u["id"], "items.product_id": {"$ne": item.product_id}},
            {"$push": {"items": {"product_id": item.product_id, "quantity": item.quantity}}}
        )
    return await _get_enriched_cart(u["id"])

@router.put("/items/{product_id}")
async def update_item(product_id: str, quantity: int, u: dict = Depends(get_current_user)):
    if quantity <= 0:
        return await remove_item(product_id, u)
    db = get_db()
    await db.carts.update_one({"user_id": u["id"], "items.product_id": product_id},
        {"$set": {"items.$.quantity": quantity}})
    return await _get_enriched_cart(u["id"])

@router.delete("/items/{product_id}")
async def remove_item(product_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    await db.carts.update_one({"user_id": u["id"]}, {"$pull": {"items": {"product_id": product_id}}})
    return await _get_enriched_cart(u["id"])

@router.delete("")
async def clear_cart(u: dict = Depends(get_current_user)):
    db = get_db()
    await db.carts.update_one({"user_id": u["id"]}, {"$set": {"items": []}})
    return {"message": "Panier vidé"}
