from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import jwt
from config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_token(data: dict, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    to_encode = {
        **data,
        "iat": int(now.timestamp()),
        "exp": now + expires_delta,
    }
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def create_access_token(user_id: str) -> str:
    return create_token(
        {"sub": user_id, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes)
    )

def create_refresh_token(user_id: str) -> str:
    import uuid as _uuid
    jti = str(_uuid.uuid4())
    return create_token(
        {"sub": user_id, "type": "refresh", "jti": jti},
        timedelta(days=settings.refresh_token_expire_days)
    )
