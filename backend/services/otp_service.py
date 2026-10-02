import secrets, logging
from datetime import datetime, timezone, timedelta
from database import get_db, get_redis
from services.email_service import send_email
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

OTP_TTL = 600  # 10 min
OTP_LENGTH = 6
MAX_ATTEMPTS = 5

def _generate_code() -> str:
    return "".join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])

def _otp_key(user_id: str, purpose: str) -> str:
    return f"otp:{user_id}:{purpose}"

async def send_otp(user_id: str, purpose: str, channel: str = "email", target: str = None) -> dict:
    """Send OTP via email, SMS, or WhatsApp. Returns {sent: bool, expires_in: int}."""
    code = _generate_code()
    key = _otp_key(user_id, purpose)

    # Store in Redis if available, else MongoDB
    r = await get_redis()
    if r:
        await r.setex(key, OTP_TTL, f"{code}:0")  # code:attempts
    else:
        db = get_db()
        await db.otp_codes.update_one({"user_id": user_id, "purpose": purpose}, {"$set": {
            "code": code, "attempts": 0, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL)).isoformat()
        }}, upsert=True)

    # Deliver
    subject_map = {
        "verify_email": "Code de vérification AfriSupply",
        "change_email": "Confirmation changement d'email",
        "reset_password": "Réinitialisation mot de passe",
        "login_2fa": "Code de connexion AfriSupply",
        "order_confirm": "Confirmation de commande",
    }
    subject = subject_map.get(purpose, "Code AfriSupply")
    html = f'<div style="font-family:sans-serif;padding:32px"><h2>{subject}</h2><p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#FF6A00">{code}</p><p style="color:#666">Ce code expire dans 10 minutes. Ne le partagez avec personne.</p></div>'

    if channel == "email" and target:
        await send_email(target, subject, html)
    elif channel in ("sms", "whatsapp") and target:
        await _send_twilio(target, f"AfriSupply — {subject}: {code}", channel)
    else:
        logger.warning(f"[OTP] No target for {channel}/{purpose}")
        return {"sent": False, "expires_in": 0}

    logger.info(f"[OTP] {purpose}/{channel} sent to {target[:4]}***")
    return {"sent": True, "expires_in": OTP_TTL}

async def verify_otp(user_id: str, purpose: str, code: str) -> bool:
    """Verify OTP. Returns True if valid, raises on failure."""
    key = _otp_key(user_id, purpose)
    r = await get_redis()

    if r:
        raw = await r.get(key)
        if not raw:
            return False
        stored_code, attempts = raw.split(":")
        attempts = int(attempts)
        if attempts >= MAX_ATTEMPTS:
            await r.delete(key)
            return False
        if stored_code != code:
            ttl = await r.ttl(key)
            # ttl == -1 (no expiry) or -2 (no key) → fallback to default
            ttl = ttl if ttl and ttl > 0 else OTP_TTL
            await r.setex(key, ttl, f"{stored_code}:{attempts + 1}")
            return False
        await r.delete(key)
        return True
    else:
        db = get_db()
        doc = await db.otp_codes.find_one({"user_id": user_id, "purpose": purpose})
        if not doc:
            return False
        if doc.get("attempts", 0) >= MAX_ATTEMPTS:
            await db.otp_codes.delete_one({"user_id": user_id, "purpose": purpose})
            return False
        if datetime.fromisoformat(doc["expires_at"]) < datetime.now(timezone.utc):
            await db.otp_codes.delete_one({"user_id": user_id, "purpose": purpose})
            return False
        if doc["code"] != code:
            await db.otp_codes.update_one({"user_id": user_id, "purpose": purpose}, {"$inc": {"attempts": 1}})
            return False
        await db.otp_codes.delete_one({"user_id": user_id, "purpose": purpose})
        return True

async def _send_twilio(to: str, body: str, channel: str):
    if not settings.twilio_account_sid:
        logger.warning(f"[TWILIO SKIP] No credentials — would send: {body[:40]}...")
        return
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        if channel == "whatsapp":
            client.messages.create(
                body=body,
                from_=f"whatsapp:{settings.twilio_whatsapp_number}",
                to=f"whatsapp:{to}"
            )
        else:
            client.messages.create(body=body, from_=settings.twilio_phone_number, to=to)
        logger.info(f"[TWILIO] {channel} sent to {to[:4]}***")
    except Exception as e:
        logger.error(f"[TWILIO ERR] {e}")