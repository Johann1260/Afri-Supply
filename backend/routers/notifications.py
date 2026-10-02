from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from database import get_db
from dependencies import get_current_user
import uuid

router = APIRouter(prefix="/notifications", tags=["notifications"])

async def create_notification(user_id: str, type: str, title: str, message: str, related_id: str = None):
    db = get_db()
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": user_id,
        "type": type, "title": title, "message": message,
        "is_read": False, "related_id": related_id,
        "created_at": datetime.now(timezone.utc).isoformat()})

@router.get("")
async def get_notifications(u: dict = Depends(get_current_user), skip: int=0, limit: int=20):
    db = get_db()
    items = await db.notifications.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.notifications.count_documents({"user_id": u["id"]})
    unread = await db.notifications.count_documents({"user_id": u["id"], "is_read": False})
    return {"items": items, "total": total, "unread": unread}

@router.get("/unread-count")
async def unread_count(u: dict = Depends(get_current_user)):
    db = get_db()
    count = await db.notifications.count_documents({"user_id": u["id"], "is_read": False})
    return {"unread_count": count}

@router.post("/{notification_id}/read")  # legacy POST compat
@router.put("/{notification_id}/read")
async def mark_read(notification_id: str, u: dict = Depends(get_current_user)):
    db = get_db()
    await db.notifications.update_one({"id": notification_id, "user_id": u["id"]}, {"$set": {"is_read": True}})
    return {"message": "Lu"}

@router.post("/read-all")  # legacy POST compat
@router.put("/read-all")
async def mark_all_read(u: dict = Depends(get_current_user)):
    db = get_db()
    await db.notifications.update_many({"user_id": u["id"], "is_read": False}, {"$set": {"is_read": True}})
    return {"message": "Tout marqué comme lu"}

@router.delete("")
async def clear_notifications(u: dict = Depends(get_current_user)):
    db = get_db()
    await db.notifications.delete_many({"user_id": u["id"]})
    return {"message": "Notifications supprimées"}