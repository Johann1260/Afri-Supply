from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from database import get_db
from dependencies import get_current_user, require_admin
from models.common import BlogPostCreate, BlogPostUpdate
import uuid

router = APIRouter(prefix="/blog", tags=["blog"])

@router.get("")
async def get_posts(skip: int=0, limit: int=10, published: bool=True):
    db = get_db()
    q = {"is_published": True} if published else {}
    posts = await db.blog_posts.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.blog_posts.count_documents(q)
    return {"posts": posts, "total": total}

@router.get("/{post_id}")
async def get_post(post_id: str):
    db = get_db()
    post = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    if not post: raise HTTPException(404, "Article non trouvé")
    await db.blog_posts.update_one({"id": post_id}, {"$inc": {"views": 1}})
    return post

@router.post("")
async def create_post(data: BlogPostCreate, u: dict = Depends(require_admin)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": str(uuid.uuid4()), "author_id": u["id"], "author_name": u["full_name"],
        "views": 0, "is_published": False, "created_at": now, "updated_at": now, **data.model_dump(exclude_none=True)}
    await db.blog_posts.insert_one(doc)
    return doc

@router.put("/{post_id}")
async def update_post(post_id: str, data: BlogPostUpdate, u: dict = Depends(require_admin)):
    db = get_db()
    update = {**data.model_dump(exclude_none=True), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.blog_posts.update_one({"id": post_id}, {"$set": update})
    return await db.blog_posts.find_one({"id": post_id}, {"_id": 0})

@router.delete("/{post_id}")
async def delete_post(post_id: str, u: dict = Depends(require_admin)):
    db = get_db()
    await db.blog_posts.delete_one({"id": post_id})
    return {"message": "Article supprimé"}