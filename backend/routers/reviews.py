from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from database import get_db
from dependencies import get_current_user
from models.common import ReviewCreate
import uuid

router = APIRouter(prefix="/reviews", tags=["reviews"])

@router.get("/pending")
async def get_pending_reviews(u: dict = Depends(get_current_user)):
    """Batch: 3 requêtes fixes au lieu de O(orders×items) requêtes séquentielles."""
    db = get_db()
    orders = await db.orders.find(
        {"buyer_id": u["id"], "status": "delivered"}, {"_id": 0}
    ).to_list(100)
    if not orders:
        return []

    all_pairs = [(o, item) for o in orders for item in o.get("items", [])]
    order_ids = [o["id"] for o in orders]
    product_ids = list({item["product_id"] for _, item in all_pairs})

    # Batch 1: reviews existantes
    done = {
        (r["product_id"], r["order_id"])
        async for r in db.reviews.find(
            {"order_id": {"$in": order_ids}, "user_id": u["id"]},
            {"_id": 0, "product_id": 1, "order_id": 1}
        )
    }
    # Batch 2: produits
    prods = {p["id"]: p async for p in db.products.find(
        {"id": {"$in": product_ids}}, {"_id": 0, "id": 1, "images": 1}
    )}

    pending = []
    for order, item in all_pairs:
        pid = item["product_id"]
        if (pid, order["id"]) not in done and pid in prods:
            pending.append({
                "order_id": order["id"],
                "order_number": order.get("order_number", ""),
                "product_id": pid,
                "product_name": item["product_name"],
                "product_image": prods[pid].get("images", [None])[0],
            })
    return pending

@router.get("/products/{product_id}")
async def get_product_reviews(product_id: str, skip: int=0, limit: int=10):
    db = get_db()
    return await db.reviews.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

@router.post("")
async def create_review(data: ReviewCreate, u: dict = Depends(get_current_user)):
    db = get_db()
    if not 1 <= data.rating <= 5: raise HTTPException(400, "Note entre 1 et 5")
    order = await db.orders.find_one({"id": data.order_id, "buyer_id": u["id"], "status": "delivered"}, {"_id": 0})
    if not order: raise HTTPException(403, "Commande non éligible")
    if not any(i["product_id"] == data.product_id for i in order.get("items", [])):
        raise HTTPException(403, "Produit non inclus dans cette commande")
    existing = await db.reviews.find_one({"product_id": data.product_id, "order_id": data.order_id, "user_id": u["id"]})
    if existing: raise HTTPException(400, "Déjà évalué")
    product = await db.products.find_one({"id": data.product_id}, {"_id": 0})
    if not product: raise HTTPException(404, "Produit non trouvé")
    rid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    review = {"id": rid, "product_id": data.product_id, "order_id": data.order_id,
        "supplier_id": product.get("supplier_id"), "user_id": u["id"],
        "rating": data.rating, "comment": data.comment, "created_at": now}
    await db.reviews.insert_one(review)
    # find_one_and_update atomique : évite race condition entre $inc et recalcul
    from pymongo import ReturnDocument
    updated = await db.products.find_one_and_update(
        {"id": data.product_id},
        {"$inc": {"review_count": 1, "rating_sum": data.rating}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0, "rating_sum": 1, "review_count": 1}
    )
    if updated and updated.get("review_count", 0) > 0:
        new_rating = round((updated.get("rating_sum") or 0) / updated["review_count"], 2)
        await db.products.update_one({"id": data.product_id}, {"$set": {"rating": new_rating}})
    return {k: v for k, v in review.items() if k != "_id"}
