from fastapi import APIRouter
from database import get_db
from services.cache_service import cache_get, cache_set, CACHE_TTL

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("")
async def get_categories():
    cached = await cache_get("categories:all")
    if cached: return cached
    db = get_db()
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    await cache_set("categories:all", cats, CACHE_TTL["categories"])
    return cats

@router.get("/{cat_id}/products/count")
async def count_products(cat_id: str):
    db = get_db()
    return {"count": await db.products.count_documents({"category_id": cat_id, "is_available": True})}