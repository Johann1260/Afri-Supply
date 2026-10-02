from pydantic import BaseModel
from typing import Optional

class OTPSend(BaseModel):
    purpose: str  # verify_email, change_email, reset_password, login_2fa, order_confirm
    channel: str = "email"  # email, sms, whatsapp
    target: Optional[str] = None  # email/phone override

class OTPVerify(BaseModel):
    purpose: str
    code: str
    target: Optional[str] = None

class EmailChangeRequest(BaseModel):
    new_email: str
    otp_code: str  # OTP sent to OLD email