from database import get_db
from datetime import datetime, timezone
import uuid


async def log_action(
    admin_id: str,
    admin_name: str,
    action: str,
    detail: str,
    target_type: str | None = None,
    target_id: str | None = None,
) -> dict:
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "admin_name": admin_name,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "detail": detail,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.admin_logs.insert_one(doc)
    except Exception:
        pass  # Ne jamais bloquer l'action principale pour un log
    return {k: v for k, v in doc.items() if k != "_id"}
