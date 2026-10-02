from fastapi import APIRouter, Depends, HTTPException, Request
from models.otp import OTPSend, OTPVerify
from dependencies import get_current_user
from services.otp_service import send_otp, verify_otp
from database import get_db
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/otp", tags=["otp"])
limiter = Limiter(key_func=get_remote_address)

@router.post("/send")
@limiter.limit("5/minute")
async def send(request: Request, data: OTPSend, u: dict = Depends(get_current_user)):
    target = data.target
    if not target:
        target = u.get("email") if data.channel == "email" else u.get("phone")
    if not target:
        raise HTTPException(400, "Aucune cible disponible pour ce canal")
    result = await send_otp(u["id"], data.purpose, data.channel, target)
    if not result["sent"]:
        raise HTTPException(500, "Échec d'envoi")
    return {"message": "Code envoyé", "expires_in": result["expires_in"]}

@router.post("/verify")
@limiter.limit("10/minute")
async def verify(request: Request, data: OTPVerify, u: dict = Depends(get_current_user)):
    valid = await verify_otp(u["id"], data.purpose, data.code)
    if not valid:
        raise HTTPException(400, "Code invalide ou expiré")
    return {"message": "Code vérifié", "verified": True}