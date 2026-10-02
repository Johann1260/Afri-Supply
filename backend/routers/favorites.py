from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/favorites", tags=["favorites"])

@router.get("")
async def get_favorites(u: dict = Depends(get_current_user)):
    db = get_db()
    fav_ids = u.get("favorites", [])
    if not fav_ids: return []
    prods = await db.products.find({"id": {"$in": fav_ids}}, {"_id": 0}).to_list(100)
    return prods

@router.post("/{product_id}")
async def add_favorite(product_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    if not await db.products.find_one({"id": product_id}):
        raise HTTPException(404, "Produit non trouvé")
    await db.users.update_one({"id": u["id"]}, {"$addToSet": {"favorites": product_id}})
    return {"message": "Ajouté aux favoris"}

@router.delete("/{product_id}")
async def remove_favorite(product_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one({"id": u["id"]}, {"$pull": {"favorites": product_id}})
    return {"message": "Retiré des favoris"}