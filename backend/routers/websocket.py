from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from datetime import datetime, timezone
from database import get_db, get_redis
from services.bypass_service import detect_bypass, BLOCKED_TEXT, generate_anonymous_id
from config import get_settings
import json, uuid, asyncio, logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])
settings = get_settings()

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    def connect(self, user_id: str, ws: WebSocket):
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        conns = self.active.get(user_id, [])
        if ws in conns: conns.remove(ws)
        if not conns: self.active.pop(user_id, None)

    async def send_to(self, user_id: str, data: dict):
        for ws in list(self.active.get(user_id, [])):
            try:
                await ws.send_json(data)
            except (WebSocketDisconnect, RuntimeError, ConnectionError):
                self.disconnect(user_id, ws)
            except Exception as e:
                logger.error(f"WS send_to {user_id} unexpected error: {e}")

manager = ConnectionManager()

@router.websocket("/ws/messages")
async def ws_messages(websocket: WebSocket):
    """JWT transmis dans le premier message JSON {type:"auth", token:"..."} — jamais dans l URL."""
    await websocket.accept()
    try:
        auth_raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        auth_msg = json.loads(auth_raw)
        if auth_msg.get("type") != "auth":
            await websocket.close(4001); return
        token = auth_msg.get("token", "")
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(4001); return
    except (JWTError, asyncio.TimeoutError, json.JSONDecodeError, ValueError, KeyError):
        await websocket.close(4001); return

    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0}) or {}
    # Vérifie que le token n'a pas été invalidé (logout, reset password, etc.)
    inv_at = user.get("token_invalidated_at")
    if inv_at and payload.get("iat", 0) < inv_at:
        await websocket.close(4001); return

    manager.connect(user_id, websocket)
    r = await get_redis()
    rate_key = f"ws_rate:{user_id}"

    try:
        while True:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=60)
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                continue

            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            receiver_id = data.get("receiver_id")
            content = str(data.get("content", "")).strip()[:2000]
            if not receiver_id or not content:
                continue

            # Rate limiting atomique Redis (pipeline INCR+EXPIRE)
            if r:
                try:
                    pipe = r.pipeline()
                    pipe.incr(rate_key)
                    pipe.expire(rate_key, 60)
                    results = await pipe.execute()
                    if results[0] > 30:
                        await websocket.send_json({"type": "error", "message": "Limite de messages atteinte"})
                        continue
                except Exception:
                    pass  # Redis down -> pas de rate limiting, on continue

            now = datetime.now(timezone.utc).isoformat()
            mid = str(uuid.uuid4())
            blocked = detect_bypass(content)

            # PHASE 2 FIX: gate commande payee — meme regle que REST /messages
            is_admin = user.get("user_type") == "admin"
            if not is_admin:
                has_paid = bool(await db.orders.find_one({
                    "$or": [
                        {"buyer_id": user_id, "supplier_id": receiver_id},
                        {"buyer_id": receiver_id, "supplier_id": user_id},
                    ],
                    "payment_status": "paid"
                }))
                if not has_paid:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Commande payee requise pour demarrer cette conversation"
                    })
                    continue

            # Valider que le destinataire existe
            if not await db.users.find_one({"id": receiver_id}, {"_id": 0, "id": 1}):
                await websocket.send_json({"type": "error", "message": "Destinataire inconnu"})
                continue

            msg_doc = {
                "id": mid,
                "sender_id": "system" if blocked else user_id,
                "sender_name": "AfriSupply" if blocked else generate_anonymous_id(user_id),
                "receiver_id": user_id if blocked else receiver_id,
                "receiver_name": generate_anonymous_id(receiver_id) if not blocked else "",
                "content": BLOCKED_TEXT if blocked else content,
                "product_id": data.get("product_id"),
                "is_read": False,
                "created_at": now,
            }
            await db.messages.insert_one(msg_doc)

            if blocked:
                await db.bypass_attempts.insert_one({
                    "user_id": user_id, "target_id": receiver_id,
                    "original_content": content, "reason": "ws_bypass", "created_at": now
                })
                await websocket.send_json({"type": "message", **{k: v for k, v in msg_doc.items() if k != "_id"}})
                continue

            out = {k: v for k, v in msg_doc.items() if k != "_id"}
            await manager.send_to(receiver_id, {"type": "message", **out})
            await websocket.send_json({"type": "message", **out})

    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        manager.disconnect(user_id, websocket)
