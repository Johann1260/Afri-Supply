from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List

class Settings(BaseSettings):
    # App
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    admin_email: str = "admin@afrisupply.com"

    # MongoDB
    mongo_url: str
    db_name: str = "afrisupply"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Stripe
    stripe_api_key: str = ""
    stripe_webhook_secret: str = ""

    # Resend
    resend_api_key: str = ""

    # CORS
    allowed_origins: str = ""

    # OpenAI
    openai_api_key: str = ""

    # Twilio (SMS/WhatsApp OTP)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    twilio_whatsapp_number: str = ""

    # Trade Assurance
    escrow_hold_days: int = 14

    # Monitoring
    sentry_dsn: str = ""

    # FX (XAF -> USD for Stripe) -- taux BEAC reel: 655.957 XAF/EUR ~ 610 XAF/USD
    xaf_usd_rate: float = 610.0

    # S3 / CDN pour les images (optionnel -- fallback local si non configure)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "eu-west-3"
    s3_bucket: str = ""
    cdn_url: str = ""

    @property
    def s3_enabled(self) -> bool:
        return bool(self.aws_access_key_id and self.s3_bucket)

    @property
    def is_prod(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origins(self) -> List[str]:
        if self.allowed_origins:
            return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]
        if self.is_prod:
            return ["https://afrisupply.com", "https://afri-supply.vercel.app"]
        return ["http://localhost:3000", "http://localhost:5173",
                "https://afrisupply.com", "https://afri-supply.vercel.app"]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
