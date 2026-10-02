from fastapi import APIRouter, Depends, HTTPException, Request, Query
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from dependencies import get_current_user
from models.message import MessageCreate
from services.bypass_service import detect_bypass, generate_anonymous_id, localize_anonymous_id, BLOCKED_TEXT
import uuid, re, html

router = APIRouter(prefix="/messages", tags=["messages"])
limiter = Limiter(key_func=get_remote_address)

def sanitize(v, n=2000): return re.sub(r'<[^>]+>', '', html.unescape(str(v)))[:n].strip()

def _get_lang(request) -> str:
    accept = getattr(request, "headers", {}).get("accept-language", "fr") if request else "fr"
    return accept[:2].lower() if accept else "fr"

def _anon(user_id: str, lang: str) -> str:
    return localize_anonymous_id(generate_anonymous_id(user_id), lang)

async def _has_paid_order(db, buyer_id, supplier_id) -> bool:
    return bool(await db.orders.find_one({"buyer_id": buyer_id, "supplier_id": supplier_id, "payment_status": "paid"}))

@router.post("")
@limiter.limit("30/minute")
async def send_message(request: Request, msg: MessageCreate, u: dict = Depends(get_current_user)):
    lang = _get_lang(request)
    db = get_db()
    receiver = await db.users.find_one({"id": msg.receiver_id}, {"_id": 0})
    if not receiver: raise HTTPException(404, "Destinataire non trouvé")
    if u["id"] != msg.receiver_id and u.get("user_type") != "admin":
        buyer_id, supplier_id = (u["id"], msg.receiver_id) if u.get("user_type") == "buyer" else (msg.receiver_id, u["id"])
        if not await _has_paid_order(db, buyer_id, supplier_id):
            raise HTTPException(403, "Commande payée requise pour démarrer cette conversation")
    content = sanitize(msg.content)
    now = datetime.now(timezone.utc).isoformat()
    mid = str(uuid.uuid4())
    if detect_bypass(content):
        await db.bypass_attempts.insert_one({"user_id": u["id"], "target_id": msg.receiver_id,
            "original_content": content, "reason": "contact_hors_plateforme", "created_at": now})
        doc = {"id": mid, "sender_id": u["id"],
            "sender_name": _anon(u["id"], lang),
            "receiver_id": msg.receiver_id,
            "receiver_name": _anon(msg.receiver_id, lang),
            "content": BLOCKED_TEXT, "product_id": msg.product_id,
            "is_read": False, "is_system_warning": True, "created_at": now}
        await db.messages.insert_one(doc)
        return doc
    doc = {"id": mid, "sender_id": u["id"],
        "sender_name": _anon(u["id"], lang),
        "receiver_id": msg.receiver_id,
        "receiver_name": _anon(msg.receiver_id, lang),
        "content": content, "product_id": msg.product_id, "is_read": False, "created_at": now}
    await db.messages.insert_one(doc)
    return doc

@router.get("/conversations")
async def get_conversations(request: Request, u: dict = Depends(get_current_user)):
    """Aggregation pipeline — O(1) memory regardless of message volume."""
    lang = _get_lang(request)
    db = get_db()
    uid = u["id"]
    # Single pipeline: group by conversation partner, keep latest message per pair
    pipeline = [
        {"$match": {"$or": [{"sender_id": uid}, {"receiver_id": uid}]}},
        {"$sort": {"created_at": -1}},
        {"$addFields": {
            "partner_id": {
                "$cond": [{"$eq": ["$sender_id", uid]}, "$receiver_id", "$sender_id"]
            }
        }},
        {"$group": {
            "_id": "$partner_id",
            "last_message": {"$first": "$content"},
            "last_message_time": {"$first": "$created_at"},
            "unread_count": {
                "$sum": {
                    "$cond": [
                        {"$and": [{"$eq": ["$receiver_id", uid]}, {"$eq": ["$is_read", False]}]},
                        1, 0
                    ]
                }
            }
        }},
        {"$sort": {"last_message_time": -1}},
        {"$limit": 50},
    ]
    rows = await db.messages.aggregate(pipeline).to_list(50)
    return [
        {
            "partner_id": r["_id"],
            "partner_name": _anon(r["_id"], lang),
            "partner_company": None,
            "last_message": (r["last_message"] or "")[:100],
            "last_message_time": r["last_message_time"],
            "unread_count": r["unread_count"],
        }
        for r in rows
    ]


@router.get("/{partner_id}")
async def get_messages(
    partner_id: str,
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    u: dict = Depends(get_current_user),
):
    lang = _get_lang(request)
    db = get_db()
    uid = u["id"]
    you = "Vous" if lang == "fr" else "You"
    cursor = db.messages.find(
        {"$or": [
            {"sender_id": uid, "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": uid},
        ]},
        {"_id": 0},
    ).sort("created_at", 1).skip(skip).limit(limit)
    msgs = await cursor.to_list(limit)
    for m in msgs:
        m["sender_name"] = _anon(m["sender_id"], lang) if m["sender_id"] != uid else you
        m["receiver_name"] = _anon(m["receiver_id"], lang) if m["receiver_id"] != uid else you
    return {"messages": msgs, "skip": skip, "limit": limit, "has_more": len(msgs) == limit}
