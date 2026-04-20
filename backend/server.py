import asyncio

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import json
from openai import OpenAI  # Remplace emergentintegrations.llm.chat
import stripe  # Pour les paiements
from fastapi import Form, File, UploadFile
import shutil
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
# PDF generation — fiche produit industrielle
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.platypus import KeepTogether
from io import BytesIO
import base64
from starlette.responses import Response
# Sécurité — Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Sécurité — Sanitisation
import re
import html
import secrets
# ======================= MOTEUR ANTI-CONTOURNEMENT =======================
# Détecte et bloque tout contact hors-plateforme dans les messages et RFQ

# Patterns de numéros de téléphone (international + local Afrique)
_PHONE_PATTERNS = [
    r'\b(\+?\d[\s\-\.]?){7,15}\b',                     # numéro international générique
    r'\b0[567]\d[\s\-\.]?\d{2}[\s\-\.]?\d{2}[\s\-\.]?\d{2}\b',  # mobile FR/Afrique
    r'\b6\d{8}\b',                                            # Cameroun (6XX XXX XXX)
    r'\b\+237[\s\-]?[67]\d{7,8}\b',                      # +237 Cameroun
    r'\b\+241[\s\-]?\d{7,8}\b',                          # +241 Gabon
    r'\b\+242[\s\-]?\d{7,9}\b',                          # +242 Congo
    r'\b\+235[\s\-]?\d{7,8}\b',                          # +235 Tchad
]

# Patterns email
_EMAIL_PATTERNS = [
    r'[a-zA-Z0-9._%+\-]+\s*@\s*[a-zA-Z0-9.\-]+\s*\.\s*[a-zA-Z]{2,}',
    r'[a-zA-Z0-9._%+\-]+\s*\[at\]\s*[a-zA-Z0-9.\-]+',  # obfusqué [at]
    r'[a-zA-Z0-9._%+\-]+\s*arobase\s*[a-zA-Z0-9.\-]+',     # "arobase"
]

# Liens et apps de messagerie
_LINK_PATTERNS = [
    r'https?://[^\s]+',
    r'www\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}',
    r'bit\.ly/[^\s]+',
    r'wa\.me/[^\s]*',
    r't\.me/[^\s]*',
    r'wa\.link/[^\s]*',
]

# Phrases de contournement FR + EN
_BYPASS_PHRASES = [
    # Français
    r'appelle[z\-]?moi', r'contacte[z\-]?moi', r'écri[st][\-]?moi',
    r'en\s+priv[eé]', r'en\s+dehors', r'hors\s+(de\s+)?la\s+plateforme',
    r'directement', r'mon\s+num[eé]ro', r'mon\s+t[eé]l[eé]phone',
    r'mon\s+whatsapp', r'mon\s+telegram', r'mon\s+email',
    r'je\s+t[\'e]envoie\s+(directement|en\s+priv)',
    r'on\s+continue\s+en\s+priv', r'passe\s+par\s+whatsapp',
    r'via\s+whatsapp', r'sur\s+whatsapp', r'sur\s+telegram',
    r'sortir\s+de\s+la\s+plateforme', r'contourne[z\-]?',
    r'sans\s+passer\s+par', r'par\s+ailleurs', r'mon\s+mail',
    r'envoie[z\-]?moi\s+(un\s+)?message', r'rejoins\s+moi',
    r'rejoignez\s+moi', r'venez\s+me\s+voir', r'passez\s+me\s+voir',
    # Anglais
    r'call\s+me', r'contact\s+me', r'write\s+to\s+me',
    r'in\s+private', r'outside\s+(the\s+)?platform',
    r'directly', r'my\s+number', r'my\s+phone', r'my\s+whatsapp',
    r'my\s+telegram', r'my\s+email', r"i'?ll\s+send\s+you\s+directly",
    r'let.?s\s+continue\s+privately', r'via\s+whatsapp',
    r'on\s+whatsapp', r'on\s+telegram', r'bypass', r'my\s+mail',
    r'send\s+me\s+a\s+message', r'join\s+me',
    # Apps
    r'whatsapp', r'telegram', r'signal', r'viber', r'wechat', r'imo\b',
    r'facebook\s+messenger', r'messenger', r'line\s+app',
]

# Mots-clés de coordonnées obfusquées
_OBFUSCATION_PATTERNS = [
    r'\bzero\b', r'\bun\b.*\bdeux\b', r'\bone\b.*\btwo\b',
    r'\bpoint\b.*\bcom\b', r'\btiret\b.*\btiret\b',
    r'[a-z]\s[a-z]\s[a-z]\s*@',           # e m a i l obfusqué
    r'\d\s+\d\s+\d\s+\d\s+\d\s+\d',  # numéro espacé
]

_ALL_PATTERNS = (
    _PHONE_PATTERNS + _EMAIL_PATTERNS + _LINK_PATTERNS +
    [f"(?i){p}" for p in _BYPASS_PHRASES] +
    _OBFUSCATION_PATTERNS
)
_COMPILED = [re.compile(p, re.IGNORECASE) for p in _ALL_PATTERNS]


def detect_bypass(text: str) -> dict:
    """
    Analyse un message texte.
    Retourne {"blocked": bool, "reason": str, "cleaned": str}
    """
    if not text:
        return {"blocked": False, "reason": "", "cleaned": text}

    for pattern in _COMPILED:
        if pattern.search(text):
            return {
                "blocked": True,
                "reason": "contact_hors_plateforme",
                "cleaned": text
            }
    return {"blocked": False, "reason": "", "cleaned": text}


BLOCKED_MESSAGE_TEXT = (
    "⚠️ Ce message a été bloqué automatiquement par AfriSupply.\n"
    "Les échanges de coordonnées personnelles (téléphone, email, WhatsApp, "
    "liens externes) sont interdits avant la confirmation d'un paiement.\n"
    "Finalisez votre commande sur la plateforme pour accéder aux coordonnées "
    "directes de votre partenaire. — Équipe AfriSupply"
)


def generate_anonymous_id(user_id: str) -> str:
    """Génère un identifiant anonyme stable et lisible depuis un user_id."""
    import hashlib
    h = hashlib.sha256(user_id.encode()).hexdigest()[:6].upper()
    return f"Partenaire-{h}"


async def buyer_has_paid_order_with_supplier(db, buyer_id: str, supplier_id: str) -> bool:
    """True si l'acheteur a au moins une commande payée avec ce fournisseur."""
    order = await db.orders.find_one({
        "buyer_id": buyer_id,
        "supplier_id": supplier_id,
        "payment_status": "paid"
    }, {"_id": 0, "id": 1})
    return order is not None


async def get_contact_info_if_unlocked(db, requester_id: str, target_user: dict) -> dict:
    """
    Politique de contact AfriSupply :
    - JAMAIS d'informations de contact directes exposées (ni avant, ni après paiement).
    - Le contact passe TOUJOURS par la messagerie interne de la plateforme.
    - Après paiement : la messagerie est activée et les noms réels sont visibles.
    - Avant paiement : tout est anonymisé, messagerie restreinte à l'intérêt produit.
    """
    target_id = target_user.get("id", "")
    target_type = target_user.get("user_type", "")

    if target_type == "supplier":
        unlocked = await buyer_has_paid_order_with_supplier(db, requester_id, target_id)
    else:
        unlocked = await buyer_has_paid_order_with_supplier(db, target_id, requester_id)

    if unlocked:
        return {
            "display_name": target_user.get("company_name") or target_user.get("full_name"),
            "company_name": target_user.get("company_name"),
            # Coordonnées JAMAIS exposées — contact via messagerie interne uniquement
            "phone": None,
            "email": None,
            "city": target_user.get("city"),
            "country": target_user.get("country"),
            "contact_unlocked": True,
            "messaging_enabled": True,
        }
    else:
        return {
            "display_name": generate_anonymous_id(target_id),
            "company_name": None,
            "phone": None,
            "email": None,
            "city": None,
            "country": target_user.get("country"),
            "contact_unlocked": False,
            "messaging_enabled": False,
        }

# ======================= FIN MOTEUR ANTI-CONTOURNEMENT =======================


# Email
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


# ======================= CONFIG UPLOAD IMAGES =======================
UPLOAD_DIR = Path("uploads/products")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,
    minPoolSize=5,
    maxIdleTimeMS=30000,
    connectTimeoutMS=5000,
    serverSelectionTimeoutMS=5000,
    retryWrites=True,
)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is not set. Refusing to start.")
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Stripe — initialisation unique au démarrage
stripe.api_key = os.environ.get("STRIPE_API_KEY", "")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="AfriSupply API", description="B2B Industrial Marketplace for Central Africa")

# Servir les images statiques
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ======================= RATE LIMITING =======================
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ======================= UPLOADS DOCS =======================
DOCS_UPLOAD_DIR = Path("uploads/documents")
DOCS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ======================= MODELS =======================

# Middleware sécurité headers (Starlette BaseHTTPMiddleware)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src * data: blob:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "script-src 'self' 'unsafe-inline' https://js.stripe.com; "
            "frame-src https://js.stripe.com https://hooks.stripe.com; "
            "connect-src 'self' https://api.stripe.com wss:;"
        )
        # Ne pas exposer la version du serveur
        if "server" in response.headers:
            del response.headers["server"]
        return response

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    company_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    user_type: str = "buyer"  # buyer or supplier

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    full_name: str
    company_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    user_type: str
    created_at: str
    account_status: Optional[str] = None
    email_verified: Optional[bool] = None

class UserUpdate(BaseModel):
    full_name:    Optional[str] = None
    company_name: Optional[str] = None
    phone:        Optional[str] = None
    city:         Optional[str] = None
    country:      Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse

class CategoryCreate(BaseModel):
    name: str
    name_en: str
    description: Optional[str] = None
    description_en: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None

class CategoryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    name_en: str
    description: Optional[str] = None
    description_en: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None

class ProductCreate(BaseModel):
    name: str
    name_en: Optional[str] = None
    description: str
    description_en: Optional[str] = None
    category_id: str
    price: float
    min_order_quantity: int = 1
    unit: str = "piece"
    stock_quantity: int = 0
    specifications: Optional[Dict[str, Any]] = None
    images: List[str] = []
    is_available: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None
    description_en: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = None
    min_order_quantity: Optional[int] = None
    unit: Optional[str] = None
    stock_quantity: Optional[int] = None
    specifications: Optional[Dict[str, Any]] = None
    images: Optional[List[str]] = None
    is_available: Optional[bool] = None

class ProductResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    name_en: Optional[str] = None
    description: Optional[str] = None      # ← Change ici
    description_en: Optional[str] = None
    category_id: str
    category_name: Optional[str] = None
    supplier_id: str
    supplier_name: Optional[str] = None
    supplier_company: Optional[str] = None
    price: float
    min_order_quantity: int
    unit: str
    stock_quantity: int
    specifications: Optional[Dict[str, Any]] = None
    images: List[str]
    is_available: bool
    rating: float = 0.0
    review_count: int = 0
    created_at: str

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1, le=10000)

class CartItemResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str
    product_name: str
    product_image: Optional[str] = None
    supplier_id: str
    supplier_name: str
    price: float
    quantity: int
    unit: str
    subtotal: float

class CartResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    items: List[CartItemResponse]
    total: float
    item_count: int

class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int
    price: float

class OrderCreate(BaseModel):
    payment_method: str = "stripe"
    notes: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_country: Optional[str] = None

class OrderResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    order_number: str
    buyer_id: str
    buyer_name: str
    supplier_id: str
    supplier_name: str
    items: List[Dict[str, Any]]
    subtotal: float
    total: float
    status: str
    payment_status: str
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_country: Optional[str] = None
    created_at: str

class ReviewCreate(BaseModel):
    product_id: str
    order_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    product_id: str
    order_id: str
    user_id: str
    user_name: str
    rating: int
    comment: Optional[str] = None
    created_at: str

# ======================= SUPPLIER RATING MODELS =======================

class SupplierRatingCreate(BaseModel):
    supplier_id: str
    order_id: str
    rating: int = Field(..., ge=1, le=5)
    communication_rating: int = Field(..., ge=1, le=5)
    quality_rating: int = Field(..., ge=1, le=5)
    delivery_rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class SupplierRatingResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    supplier_id: str
    buyer_id: str
    buyer_name: str
    order_id: str
    rating: float
    communication_rating: int
    quality_rating: int
    delivery_rating: int
    comment: Optional[str] = None
    created_at: str

class SupplierProfileResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    rating: float = 0.0
    rating_count: int = 0
    communication_avg: float = 0.0
    quality_avg: float = 0.0
    delivery_avg: float = 0.0
    products_count: int = 0
    orders_completed: int = 0
    member_since: str

class MessageCreate(BaseModel):
    receiver_id: str
    content: str
    product_id: Optional[str] = None

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    sender_id: str
    sender_name: str
    receiver_id: str
    receiver_name: str
    content: str
    product_id: Optional[str] = None
    is_read: bool
    created_at: str

class ConversationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    partner_id: str
    partner_name: str
    partner_company: Optional[str] = None
    last_message: str
    last_message_time: str
    unread_count: int

class BlogPostCreate(BaseModel):
    title: str
    title_en: Optional[str] = None
    content: str
    content_en: Optional[str] = None
    excerpt: Optional[str] = None
    excerpt_en: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []

class BlogPostResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    title_en: Optional[str] = None
    content: str
    content_en: Optional[str] = None
    excerpt: Optional[str] = None
    excerpt_en: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    tags: List[str]
    author_id: str
    author_name: str
    created_at: str
    views: int = 0

class CheckoutRequest(BaseModel):
    origin_url: str

class PaymentStatusResponse(BaseModel):
    status: str
    payment_status: str
    order_id: Optional[str] = None

# ======================= RFQ MODELS =======================

class RFQCreate(BaseModel):
    product_id: str
    supplier_id: str
    quantity: int
    target_price: Optional[float] = None
    delivery_location: str
    delivery_deadline: Optional[str] = None
    specifications: Optional[str] = None
    notes: Optional[str] = None

class RFQResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    rfq_number: str
    product_id: str
    product_name: str
    supplier_id: str
    supplier_name: str
    buyer_id: str
    buyer_name: str
    buyer_company: Optional[str] = None
    quantity: int
    target_price: Optional[float] = None
    quoted_price: Optional[float] = None
    delivery_location: str
    delivery_deadline: Optional[str] = None
    specifications: Optional[str] = None
    notes: Optional[str] = None
    status: str  # pending, quoted, accepted, rejected, expired
    supplier_response: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

class RFQQuote(BaseModel):
    quoted_price: float
    delivery_time: Optional[str] = None
    response_notes: Optional[str] = None

# ======================= MOBILE MONEY MODELS =======================

class MobileMoneyPaymentRequest(BaseModel):
    phone_number: str
    network: str  # MTN, Orange, Airtel
    country_code: str = "CM"  # Default Cameroon

class MobileMoneyPaymentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str
    status: str
    amount: float
    currency: str
    phone_number: str
    network: str
    payment_instruction: str
    created_at: str

# ======================= NOTIFICATION MODELS =======================

class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str  # order, message, rfq, review, system
    title: str
    message: str
    is_read: bool
    related_id: Optional[str] = None
    created_at: str

# ========================== TRACKING MODELS =============================

class TrackingEventCreate(BaseModel):
    status: str
    location: Optional[str] = None
    note: Optional[str] = None

class TrackingEventResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    order_id: str
    status: str
    location: Optional[str] = None
    note: Optional[str] = None
    created_by: str
    created_at: str


# ======================= AUTH HELPERS =======================
def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        return user
    except JWTError:
        return None
    

# ======================= SANITISATION =======================

def sanitize_string(value: str, max_length: int = 500) -> str:
    """Supprime les balises HTML et limite la longueur."""
    if not value:
        return ""
    clean = re.sub(r'<[^>]+>', '', str(value))
    clean = html.unescape(clean)
    return clean[:max_length].strip()

def sanitize_user_input(data: dict) -> dict:
    """Sanitise tous les champs string d'un dict."""
    return {
        k: sanitize_string(v) if isinstance(v, str) else v
        for k, v in data.items()
    }

# ======================= EMAIL =======================

EMAIL_HOST     = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT     = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USER     = os.environ.get("EMAIL_USER", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
EMAIL_FROM     = os.environ.get("EMAIL_FROM", "noreply@afrisupply.com")
FRONTEND_URL   = os.environ.get("FRONTEND_URL", "http://localhost:3000")

async def send_email(to: str, subject: str, html_body: str):
    """Envoie un email via SMTP. Silencieux si non configuré."""
    if not EMAIL_USER or not EMAIL_PASSWORD:
        logger.info(f"[EMAIL MOCK] To: {to} | Subject: {subject}")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = EMAIL_FROM
        msg["To"]      = to
        msg.attach(MIMEText(html_body, "html"))
        await aiosmtplib.send(
            msg,
            hostname=EMAIL_HOST,
            port=EMAIL_PORT,
            username=EMAIL_USER,
            password=EMAIL_PASSWORD,
            start_tls=True,
        )
        return True
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False

def make_verification_email(name: str, link: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#034168">Bienvenue sur AfriSupply, {name} !</h2>
      <p>Cliquez sur le bouton ci-dessous pour confirmer votre adresse email :</p>
      <a href="{link}" style="display:inline-block;background:#FF6A00;color:#fff;
         padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
        Confirmer mon email
      </a>
      <p style="color:#888;font-size:12px">Ce lien expire dans 24 heures.<br>
      Si vous n'avez pas créé de compte AfriSupply, ignorez cet email.</p>
    </div>
    """

def make_document_notification_email(company: str, user_email: str, doc_count: int) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#034168">Nouveau fournisseur en attente de vérification</h2>
      <p><strong>Entreprise :</strong> {company}<br>
         <strong>Email :</strong> {user_email}<br>
         <strong>Documents :</strong> {doc_count} fichier(s) soumis</p>
      <p>Connectez-vous au panneau d'administration pour vérifier ce compte.</p>
    </div>
    """

def make_account_approved_email(name: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#034168">Votre compte fournisseur est activé !</h2>
      <p>Bonjour {name},</p>
      <p>Votre compte AfriSupply a été vérifié et activé. Vous pouvez maintenant vous connecter
         et commencer à publier vos produits.</p>
      <a href="{FRONTEND_URL}/login" style="display:inline-block;background:#FF6A00;color:#fff;
         padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
        Accéder à mon compte
      </a>
    </div>
    """
# ======================= ADMIN ENDPOINTS =======================
@api_router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins uniquement")

    results = await asyncio.gather(
        db.users.count_documents({}),
        db.users.count_documents({"user_type": "supplier", "account_status": "active"}),
        db.users.count_documents({"user_type": "supplier", "account_status": {"$in": ["pending_review", "pending_email"]}}),
        db.orders.count_documents({}),
        db.products.count_documents({}),
        db.rfqs.count_documents({"status": "pending"}),
        db.bypass_attempts.count_documents({}),
    )

    rev_pipeline = [{"$match": {"payment_status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$total"}}}]
    rev_result   = await db.orders.aggregate(rev_pipeline).to_list(1)
    total_revenue = rev_result[0]["total"] if rev_result else 0

    recent_orders = await db.orders.find({}, {"_id": 0, "order_number": 1, "buyer_name": 1, "created_at": 1}).sort("created_at", -1).limit(5).to_list(5)
    recent_users  = await db.users.find({},  {"_id": 0, "full_name": 1,  "user_type": 1,  "created_at": 1}).sort("created_at", -1).limit(5).to_list(5)

    activity = []
    for o in recent_orders:
        activity.append({"type": "order", "message": f"Commande {o['order_number']} — {o['buyer_name']}", "created_at": o["created_at"]})
    for u in recent_users:
        activity.append({"type": "user",  "message": f"Nouveau {u['user_type']} : {u['full_name']}", "created_at": u["created_at"]})
    activity.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "total_users":       results[0],
        "active_suppliers":  results[1],
        "pending_suppliers": results[2],
        "total_orders":      results[3],
        "total_products":    results[4],
        "active_rfqs":       results[5],
        "bypass_attempts":   results[6],
        "total_revenue":     total_revenue,
        "recent_activity":   activity[:10],
    }


@api_router.get("/admin/users")
async def admin_get_users(
    limit: int = 500, skip: int = 0,
    user_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins uniquement")
    query = {}
    if user_type: query["user_type"] = user_type
    users = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0, "email_verification_token": 0, "password_reset_token": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return users


@api_router.get("/admin/suppliers/pending")
async def admin_pending_suppliers(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins uniquement")
    suppliers = await db.users.find(
        {"user_type": "supplier", "account_status": {"$in": ["pending_review", "pending_email"]}},
        {"_id": 0, "password_hash": 0, "email_verification_token": 0}
    ).sort("created_at", -1).to_list(200)
    return suppliers


@api_router.post("/admin/reject-supplier/{user_id}")
async def admin_reject_supplier(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins uniquement")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user: raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"account_status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    html_body = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#034168">Votre demande d'inscription</h2>
      <p>Bonjour {user.get('full_name', '')},</p>
      <p>Après examen de votre dossier, nous ne sommes pas en mesure d'activer votre compte
         fournisseur AfriSupply pour le moment. Contactez-nous à <a href="mailto:support@afrisupply.com">support@afrisupply.com</a>.</p>
    </div>
    """
    await send_email(user["email"], "Votre demande d'inscription AfriSupply", html_body)
    return {"message": "Fournisseur rejeté"}


@api_router.get("/admin/orders")
async def admin_get_orders(
    limit: int = 200, skip: int = 0,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins uniquement")
    query = {}
    if status: query["status"] = status
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return orders


#========================= TRACKING ENDPOINTS =======================
@api_router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str, current_user: dict = Depends(get_current_user)):
    """Récupère le tracking d'une commande."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order: raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["buyer_id"] != current_user["id"] and order["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    events = await db.order_tracking.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    return events


@api_router.post("/orders/{order_id}/tracking", response_model=TrackingEventResponse)
@limiter.limit("20/minute")
async def add_tracking_event(
    request: Request,
    order_id: str,
    event: TrackingEventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Ajoute un événement de tracking (fournisseur uniquement)."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order: raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Seul le fournisseur peut ajouter des événements de tracking")

    valid_statuses = ["preparing", "ready", "shipped", "in_transit", "delivered", "issue"]
    if event.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs acceptées : {valid_statuses}")

    event_id  = str(uuid.uuid4())
    now       = datetime.now(timezone.utc).isoformat()
    event_doc = {
        "id":         event_id,
        "order_id":   order_id,
        "status":     event.status,
        "location":   sanitize_string(event.location or "", 200),
        "note":       sanitize_string(event.note or "", 500),
        "created_by": current_user["id"],
        "created_at": now,
    }
    await db.order_tracking.insert_one(event_doc)

    # Notifier l'acheteur
    await create_notification(
        user_id=order["buyer_id"],
        type="order",
        title="Mise à jour de votre commande",
        message=f"Commande {order.get('order_number', '')} : {event.status}{' — ' + event.location if event.location else ''}",
        related_id=order_id
    )

    return TrackingEventResponse(**event_doc)

# ======================= AUTH ENDPOINTS =======================

@api_router.post("/auth/register", response_model=TokenResponse)
@limiter.limit("10/minute")      
async def register(request: Request, user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "company_name": user_data.company_name,
        "phone": user_data.phone,
        "country": user_data.country,
        "city": user_data.city,
        "user_type": user_data.user_type,
        "password_hash": get_password_hash(user_data.password),
        "created_at": now,
        "favorites": [],
        "viewed_products": []
    }
    
    await db.users.insert_one(user_doc)

    # Envoyer email de vérification
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "email_verification_token": token,
            "email_verification_expires": expires,
            "email_verified": False,
            "account_status": "pending_email"  # pending_email | pending_review | active
        }}
    )

    link = f"{FRONTEND_URL}/verify-email?token={token}"
    await send_email(
        user_data.email,
        "Confirmez votre email AfriSupply",
        make_verification_email(user_data.full_name, link)
    )

    access_token_val = create_access_token({"sub": user_id})
    refresh_token_val = create_refresh_token({"sub": user_id})
    
    user_response = UserResponse(
        id=user_id, email=user_data.email, full_name=user_data.full_name,
        company_name=user_data.company_name, phone=user_data.phone,
        country=user_data.country, city=user_data.city,
        user_type=user_data.user_type, created_at=now,
        account_status="pending_email",
        email_verified=False
    )
    return {
        "access_token": access_token_val,
        "refresh_token": refresh_token_val,
        "token_type": "bearer",
        "user": user_response
    }

@api_router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("10/minute")      
async def login(request: Request, credentials: UserLogin):
    # Récupérer l'utilisateur avec les champs nécessaires
    user = await db.users.find_one(
        {"email": credentials.email},
        {
            "_id": 0,
            "id": 1,
            "email": 1,
            "full_name": 1,
            "company_name": 1,
            "phone": 1,
            "country": 1,
            "city": 1,
            "user_type": 1,
            "created_at": 1,
            "password_hash": 1,          # nécessaire pour la vérification
            "email_verified": 1,
            "account_status": 1
        }
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Email ou mot de passe invalide"
        )

    # Vérification du mot de passe
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Email ou mot de passe invalide"
        )

    # === Vérifications de statut du compte (avant de générer les tokens) ===
    account_status = user.get("account_status", "active")
    email_verified = user.get("email_verified", True)  # True par défaut pour anciens comptes

    # Pour les buyers (ou tous les utilisateurs) : email confirmé
    if not email_verified and account_status == "pending_email":
        raise HTTPException(
            status_code=403,
            detail="Veuillez confirmer votre email avant de vous connecter. Vérifiez vos emails."
        )

    # Pour les suppliers : approbation manuelle
    if user.get("user_type") == "supplier" and account_status == "pending_review":
        raise HTTPException(
            status_code=403,
            detail="Votre compte est en cours de vérification (délai : 48h). Vous recevrez un email à l'activation."
        )

    # Optionnel : bloquer les comptes inactifs/suspendus
    if account_status in ["inactive", "suspended", "banned"]:
        raise HTTPException(
            status_code=403,
            detail="Votre compte est désactivé. Contactez le support."
        )

    # === Tout est OK → générer les tokens ===
    access_token = create_access_token({"sub": user["id"]})
    refresh_token = create_refresh_token({"sub": user["id"]})

    # Construire la réponse utilisateur (sans password_hash)
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        company_name=user.get("company_name"),
        phone=user.get("phone"),
        country=user.get("country"),
        city=user.get("city"),
        user_type=user["user_type"],
        created_at=user["created_at"],
        account_status=user.get("account_status", "active"),
        email_verified=user.get("email_verified", True)
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_response
    }

@api_router.post("/auth/refresh")
async def refresh_token(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

    # Vérifier que l'utilisateur existe toujours
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = create_access_token({"sub": user_id})
    new_refresh_token = create_refresh_token({"sub": user_id})  # rotation

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"], email=current_user["email"],
        full_name=current_user["full_name"],
        company_name=current_user.get("company_name"),
        phone=current_user.get("phone"), country=current_user.get("country"),
        city=current_user.get("city"), user_type=current_user["user_type"],
        created_at=current_user["created_at"],
        account_status=current_user.get("account_status", "active"),
        email_verified=current_user.get("email_verified", True)
    )

@api_router.put("/auth/me", response_model=UserResponse)
async def update_me(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update = {
        k: sanitize_string(str(v), 200)
        for k, v in data.model_dump(exclude_none=True).items()
    }
    if not update:
        raise HTTPException(status_code=400, detail="Aucun champ valide à mettre à jour")
    await db.users.update_one({"id": current_user["id"]}, {"$set": update})
    merged = {**current_user, **update}
    return UserResponse(
        id=merged["id"], email=merged["email"],
        full_name=merged["full_name"],
        company_name=merged.get("company_name"),
        phone=merged.get("phone"), country=merged.get("country"),
        city=merged.get("city"), user_type=merged["user_type"],
        created_at=merged["created_at"],
        account_status=merged.get("account_status", "active"),
        email_verified=merged.get("email_verified", True)
    )

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@api_router.put("/auth/password")
async def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères")
    # Re-fetch user with password_hash
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": get_password_hash(data.new_password)}}
    )
    return {"message": "Mot de passe modifié avec succès"}

# ======================= VÉRIFICATION EMAIL =======================

@api_router.post("/auth/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, data: dict):
    email = data.get("email", "").strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    # Réponse identique qu'on trouve l'user ou pas (sécurité anti-enumeration)
    if user and not user.get("email_verified"):
        token = secrets.token_urlsafe(32)
        expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        await db.users.update_one(
            {"email": email},
            {"$set": {"email_verification_token": token, "email_verification_expires": expires}}
        )
        link = f"{FRONTEND_URL}/verify-email?token={token}"
        await send_email(
            email,
            "Confirmez votre email AfriSupply",
            make_verification_email(user.get("full_name", ""), link)
        )
    return {"message": "Si l'email existe, un lien a été envoyé."}

@api_router.get("/auth/verify-email")
async def verify_email(token: str):
    user = await db.users.find_one(
        {"email_verification_token": token},
        {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    
    # Vérifier l'expiration
    expires = user.get("email_verification_expires")
    if expires and datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Lien expiré")
    
    # Buyers → active immédiatement. Suppliers → garder pending_review si déjà soumis
    is_supplier = user.get("user_type") == "supplier"
    already_pending_review = user.get("account_status") == "pending_review"
    new_status = "pending_review" if (is_supplier and already_pending_review) else "active"
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"email_verified": True, "account_status": new_status},
            "$unset": {"email_verification_token": "", "email_verification_expires": ""}
        }
    )
    return {"message": "Email vérifié avec succès"}

# ======================= UPLOAD DOCUMENTS ENTREPRISE =======================

@api_router.post("/auth/documents/{user_id}")
@limiter.limit("5/minute")
async def upload_company_documents(
    request: Request,
    user_id: str,
    documents: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Seul l'utilisateur lui-même peut uploader ses docs
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    if len(documents) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 documents")
    
    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    saved_paths = []
    
    for doc in documents:
        # Vérifier type MIME
        if doc.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"Type non autorisé: {doc.content_type}")
        
        # Vérifier taille (10 Mo max)
        content = await doc.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"{doc.filename} dépasse 10 Mo")
        
        # Sauvegarder avec nom sécurisé
        ext = Path(doc.filename or "doc.pdf").suffix.lower()
        if ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
            ext = ".pdf"
        
        safe_name = f"{user_id}_{uuid.uuid4()}{ext}"
        file_path = DOCS_UPLOAD_DIR / safe_name
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        saved_paths.append(f"/uploads/documents/{safe_name}")
    
    # Mettre à jour le compte : en attente de vérification admin
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "company_documents": saved_paths,
            "account_status": "pending_review",
            "documents_submitted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notifier les admins
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@afrisupply.com")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    await send_email(
        admin_email,
        f"Nouveau fournisseur à vérifier — {user.get('company_name', 'N/A')}",
        make_document_notification_email(
            user.get("company_name", "N/A"),
            user.get("email", ""),
            len(saved_paths)
        )
    )
    
    return {"message": "Documents soumis avec succès", "count": len(saved_paths)}

# ======================= MOT DE PASSE OUBLIÉ =======================

@api_router.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: dict):
    email = data.get("email", "").strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    # Toujours répondre 200 (anti-enumeration)
    if user:
        token = secrets.token_urlsafe(32)
        expires = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_reset_token": token, "password_reset_expires": expires}}
        )
        link = f"{FRONTEND_URL}/reset-password?token={token}"
        html_body = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
          <h2 style="color:#034168">Réinitialisation de mot de passe</h2>
          <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
          <a href="{link}" style="display:inline-block;background:#FF6A00;color:#fff;
             padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
            Réinitialiser mon mot de passe
          </a>
          <p style="color:#888;font-size:12px">Ce lien expire dans 2 heures.</p>
        </div>
        """
        await send_email(email, "Réinitialisation de votre mot de passe AfriSupply", html_body)
    return {"message": "Si l'email existe, un lien a été envoyé."}

@api_router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, data: dict):
    token = data.get("token", "")
    new_password = data.get("password", "")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (min 8 caractères)")
    
    user = await db.users.find_one({"password_reset_token": token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Token invalide")
    
    expires = user.get("password_reset_expires")
    if expires and datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expiré")
    
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"password_hash": get_password_hash(new_password)},
            "$unset": {"password_reset_token": "", "password_reset_expires": ""}
        }
    )
    return {"message": "Mot de passe réinitialisé avec succès"}

# ======================= APPROBATION COMPTE (admin) =======================

@api_router.post("/admin/approve-supplier/{user_id}")
async def approve_supplier(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "account_status": "active",
            "email_verified": True,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await send_email(
        user["email"],
        "Votre compte fournisseur AfriSupply est activé !",
        make_account_approved_email(user["full_name"])
    )
    
    await create_notification(
        user_id=user_id,
        type="system",
        title="Compte activé",
        message="Votre compte fournisseur a été vérifié et activé. Bienvenue sur AfriSupply !",
        related_id=None
    )
    
    return {"message": "Compte approuvé"}

# ======================= CATEGORIES ENDPOINTS =======================

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    return categories

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(category: CategoryCreate, current_user: dict = Depends(get_current_user)):
    cat_id = str(uuid.uuid4())
    cat_doc = {"id": cat_id, **category.model_dump()}
    await db.categories.insert_one(cat_doc)
    return CategoryResponse(id=cat_id, **category.model_dump())

# ======================= PRODUCTS ENDPOINTS =======================

def _build_product_query(
    category_id=None, supplier_id=None, search=None,
    min_price=None, max_price=None, is_available=None
):
    """Construit le filtre MongoDB commun aux endpoints produits."""
    query = {}
    if category_id:
        query["category_id"] = category_id
    if supplier_id:
        query["supplier_id"] = supplier_id
    if search:
        # Utilise l'index text si disponible, sinon fallback regex
        query["$text"] = {"$search": search}
    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = min_price
        if max_price is not None:
            query["price"]["$lte"] = max_price
    if is_available is not None:
        query["is_available"] = is_available
    return query

async def _enrich_products(products: list, db) -> list:
    """Batch-enrichit les produits avec catégorie et fournisseur (évite le N+1)."""
    if not products:
        return products

    cat_ids  = list({p.get("category_id") for p in products if p.get("category_id")})
    sup_ids  = list({p.get("supplier_id")  for p in products if p.get("supplier_id")})

    categories = {c["id"]: c async for c in db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0})}
    suppliers  = {s["id"]: s async for s in db.users.find({"id": {"$in": sup_ids}}, {"_id": 0})}

    for product in products:
        cat = categories.get(product.get("category_id"), {})
        sup = suppliers.get(product.get("supplier_id"), {})
        product["category_name"]    = cat.get("name")
        product["supplier_name"]    = sup.get("full_name")
        product["supplier_company"] = sup.get("company_name")
        # S'assurer que description n'est jamais None
        if product.get("description") is None:
            product["description"] = ""

    return products


@api_router.get("/products/count")
@limiter.limit("100/minute")
async def count_products(
    request: Request,
    category_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    is_available: Optional[bool] = None,
):
    query = _build_product_query(category_id, supplier_id, search, min_price, max_price, is_available)
    count = await db.products.count_documents(query)
    return {"count": count}


@api_router.get("/products", response_model=List[ProductResponse])
@limiter.limit("100/minute")
async def get_products(
    request: Request,
    category_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    country: Optional[str] = None,
    is_available: Optional[bool] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 20
):
    query = _build_product_query(category_id, supplier_id, search, min_price, max_price, is_available)
    sort_direction = -1 if sort_order == "desc" else 1
    products = await db.products.find(query, {"_id": 0}).sort(sort_by, sort_direction).skip(skip).limit(limit).to_list(limit)
    return await _enrich_products(products, db)


@api_router.get("/products/popular", response_model=List[ProductResponse])
@limiter.limit("100/minute")
async def get_popular_products(request: Request, limit: int = 8):
    products = await db.products.find(
        {"is_available": True}, {"_id": 0}
    ).sort("rating", -1).limit(limit).to_list(limit)
    return await _enrich_products(products, db)


@api_router.get("/products/recommendations", response_model=List[ProductResponse])
@limiter.limit("100/minute")
async def get_recommendations(request: Request, current_user: dict = Depends(get_current_user)):
    """AI-powered product recommendations based on user history"""
    try:
        viewed = current_user.get("viewed_products", [])[-10:]
        favorites = current_user.get("favorites", [])
        
        context_products = []
        for pid in (viewed + favorites)[:5]:
            product = await db.products.find_one({"id": pid}, {"_id": 0, "name": 1})
            if product:
                context_products.append(product.get("name", ""))
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")  # Renommez en OPENAI_API_KEY si nécessaire
        if api_key and context_products:
            client = OpenAI(api_key=api_key)
            categories = await db.categories.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(10)
            cat_list = ", ".join([f"{c['id']}:{c['name']}" for c in categories])
            
            user_msg = f"User viewed: {', '.join(context_products)}. Categories: {cat_list}. Return 2 most relevant category IDs separated by comma."
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a B2B product recommendation assistant for an industrial marketplace in Central Africa. Respond only with category IDs."},
                    {"role": "user", "content": user_msg}
                ]
            )
            
            rec_cat_ids = [cid.strip() for cid in response.choices[0].message.content.split(",")][:2]
            products = await db.products.find(
                {"category_id": {"$in": rec_cat_ids}, "is_available": True},
                {"_id": 0}
            ).limit(8).to_list(8)
        else:
            products = await db.products.find({"is_available": True}, {"_id": 0}).sort("rating", -1).limit(8).to_list(8)
        
        return await _enrich_products(products, db)
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        products = await db.products.find({"is_available": True}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
        return await _enrich_products(products, db)

@api_router.get("/products/{product_id}", response_model=ProductResponse)
@limiter.limit("100/minute")
async def get_product(request: Request, product_id: str, current_user: dict = Depends(get_current_user_optional)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    enriched = await _enrich_products([product], db)
    product = enriched[0]
    
    # Track view for logged-in users
    if current_user:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$addToSet": {"viewed_products": product_id}}
        )
    
    return product

# ======================= PRODUCTS ENDPOINTS =======================
# ======================= CREATE PRODUCT =======================
@api_router.post("/products", response_model=ProductResponse)
@limiter.limit("20/minute")
async def create_product(
    request: Request,
    name: str = Form(...),
    description: str = Form(""),
    price: float = Form(...),
    unit: str = Form("unité"),
    min_order_quantity: int = Form(1),
    stock_quantity: int = Form(0),
    category_id: str = Form(...),
    specifications: str = Form("{}"),
    is_available: bool = Form(True),
    images: List[UploadFile] = File([]),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("user_type") != "supplier":
        raise HTTPException(status_code=403, detail="Seuls les fournisseurs peuvent créer des produits")

    image_urls = []
    for image in images:
        if image.content_type and image.content_type.startswith("image/"):
            ext = Path(image.filename or ".jpg").suffix.lower()
            filename = f"{uuid.uuid4()}{ext}"
            file_path = UPLOAD_DIR / filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(image.file, f)
            image_urls.append(f"/uploads/products/{filename}")

    try:
        specs_dict = json.loads(specifications)
    except:
        specs_dict = {}

    product_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    product_doc = {
        "id": product_id,
        "name": sanitize_string(name, 200),
        "description": sanitize_string(description, 5000),
        "price": price,
        "unit": unit,
        "min_order_quantity": min_order_quantity,
        "stock_quantity": stock_quantity,
        "category_id": category_id,
        "specifications": specs_dict,
        "images": image_urls,
        "is_available": is_available,
        "supplier_id": current_user["id"],
        "rating": 0.0,
        "review_count": 0,
        "created_at": now,
    }

    await db.products.insert_one(product_doc)

    # Enrich response
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    product_doc["category_name"] = category.get("name") if category else None
    product_doc["supplier_name"] = current_user.get("full_name")
    product_doc["supplier_company"] = current_user.get("company_name")

    return ProductResponse(**product_doc)


# ======================= UPDATE PRODUCT =======================
@api_router.put("/products/{product_id}", response_model=ProductResponse)
@limiter.limit("20/minute")
async def update_product(
    request: Request,
    product_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    unit: Optional[str] = Form(None),
    min_order_quantity: Optional[int] = Form(None),
    stock_quantity: Optional[int] = Form(None),
    category_id: Optional[str] = Form(None),
    specifications: Optional[str] = Form(None),
    is_available: Optional[bool] = Form(None),
    existing_images: str = Form("[]"),   # JSON string
    images: List[UploadFile] = File([]),
    current_user: dict = Depends(get_current_user)
):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")

    if product["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Parse existing_images
    try:
        existing_list = json.loads(existing_images)
        if not isinstance(existing_list, list):
            existing_list = []
    except Exception:
        existing_list = []

    # Nouvelles images
    new_image_urls = []
    for image in images:
        if image.content_type and image.content_type.startswith("image/"):
            ext = Path(image.filename or ".jpg").suffix.lower()
            filename = f"{uuid.uuid4()}{ext}"
            file_path = UPLOAD_DIR / filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(image.file, f)
            new_image_urls.append(f"/uploads/products/{filename}")

    final_images = existing_list + new_image_urls

    # Parse specifications
    try:
        specs_dict = json.loads(specifications) if specifications else {}
    except Exception:
        specs_dict = {}

    # Construction des données à mettre à jour (seulement les champs fournis)
    update_data = {}
    if name is not None: update_data["name"] = sanitize_string(name, 200)
    if description is not None: update_data["description"] = sanitize_string(description, 5000)
    if price is not None: update_data["price"] = price
    if unit is not None: update_data["unit"] = unit
    if min_order_quantity is not None: update_data["min_order_quantity"] = min_order_quantity
    if stock_quantity is not None: update_data["stock_quantity"] = stock_quantity
    if category_id is not None: update_data["category_id"] = category_id
    if specifications is not None: update_data["specifications"] = specs_dict
    if is_available is not None: update_data["is_available"] = is_available
    if final_images: update_data["images"] = final_images
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    await db.products.update_one({"id": product_id}, {"$set": update_data})

    # Retourner le produit mis à jour
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Produit non trouvé après mise à jour")

    category = await db.categories.find_one({"id": updated.get("category_id")}, {"_id": 0})
    supplier = await db.users.find_one({"id": updated["supplier_id"]}, {"_id": 0})

    updated["category_name"] = category.get("name") if category else None
    updated["supplier_name"] = supplier.get("full_name") if supplier else None
    updated["supplier_company"] = supplier.get("company_name") if supplier else None

    return ProductResponse(**updated)

@api_router.delete("/products/{product_id}")
@limiter.limit("20/minute")
async def delete_product(request: Request, product_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    if existing["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your product")
    
    await db.products.delete_one({"id": product_id})
    return {"message": "Product deleted"}

@api_router.get("/supplier/products", response_model=List[ProductResponse])
@limiter.limit("100/minute")
async def get_supplier_products(request: Request, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "supplier":
        raise HTTPException(status_code=403, detail="Only suppliers can access this")
    
    products = await db.products.find(
        {"supplier_id": current_user["id"]}, {"_id": 0}
    ).to_list(1000)
    return await _enrich_products(products, db)
# ======================= CART ENDPOINTS =======================

@api_router.get("/cart", response_model=CartResponse)
async def get_cart(current_user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not cart:
        cart = {"id": str(uuid.uuid4()), "user_id": current_user["id"], "items": []}
        await db.carts.insert_one(cart)

    cart_items = cart.get("items", [])
    if not cart_items:
        return CartResponse(id=cart["id"], user_id=current_user["id"], items=[], total=0.0, item_count=0)

    # Batch fetch products and suppliers
    product_ids = [i["product_id"] for i in cart_items]
    products_list = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    products_map = {p["id"]: p for p in products_list}

    supplier_ids = list({p.get("supplier_id") for p in products_list if p.get("supplier_id")})
    suppliers_list = await db.users.find({"id": {"$in": supplier_ids}}, {"_id": 0}).to_list(100)
    suppliers_map = {s["id"]: s for s in suppliers_list}

    enriched_items = []
    total = 0.0
    for item in cart_items:
        product = products_map.get(item["product_id"])
        if product:
            supplier = suppliers_map.get(product.get("supplier_id"), {})
            subtotal = product["price"] * item["quantity"]
            enriched_items.append(CartItemResponse(
                product_id=item["product_id"],
                product_name=product["name"],
                product_image=product["images"][0] if product.get("images") else None,
                supplier_id=product["supplier_id"],
                supplier_name=supplier.get("full_name", "Unknown"),
                price=product["price"],
                quantity=item["quantity"],
                unit=product["unit"],
                subtotal=subtotal
            ))
            total += subtotal

    return CartResponse(
        id=cart["id"],
        user_id=current_user["id"],
        items=enriched_items,
        total=total,
        item_count=len(enriched_items)
    )

@api_router.post("/cart/items", response_model=CartResponse)
async def add_to_cart(item: CartItemAdd, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    cart = await db.carts.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not cart:
        cart = {"id": str(uuid.uuid4()), "user_id": current_user["id"], "items": []}
    
    # Update or add item
    found = False
    for cart_item in cart.get("items", []):
        if cart_item["product_id"] == item.product_id:
            cart_item["quantity"] += item.quantity
            found = True
            break
    
    if not found:
        cart.setdefault("items", []).append({"product_id": item.product_id, "quantity": item.quantity})
    
    await db.carts.update_one(
        {"user_id": current_user["id"]},
        {"$set": cart},
        upsert=True
    )
    
    return await get_cart(current_user)

@api_router.put("/cart/items/{product_id}", response_model=CartResponse)
async def update_cart_item(product_id: str, quantity: int, current_user: dict = Depends(get_current_user)):
    if quantity <= 0:
        return await remove_from_cart(product_id, current_user)
    
    await db.carts.update_one(
        {"user_id": current_user["id"], "items.product_id": product_id},
        {"$set": {"items.$.quantity": quantity}}
    )
    return await get_cart(current_user)

@api_router.delete("/cart/items/{product_id}", response_model=CartResponse)
async def remove_from_cart(product_id: str, current_user: dict = Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": current_user["id"]},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    return await get_cart(current_user)

@api_router.delete("/cart", response_model=dict)
async def clear_cart(current_user: dict = Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"items": []}}
    )
    return {"message": "Cart cleared"}

# ======================= ORDERS ENDPOINTS =======================

async def create_orders(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")

    # BATCH : une seule requête pour tous les produits
    product_ids = [i["product_id"] for i in cart["items"]]
    products_list = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(200)
    products_map = {p["id"]: p for p in products_list}
    supplier_ids_set = {p["supplier_id"] for p in products_list if p.get("supplier_id")}
    suppliers_list = await db.users.find({"id": {"$in": list(supplier_ids_set)}}, {"_id": 0}).to_list(100)
    suppliers_map = {s["id"]: s for s in suppliers_list}
    supplier_items = {}
    for item in cart["items"]:
      product = products_map.get(item["product_id"])
      if product:
          sid = product["supplier_id"]
          supplier = suppliers_map.get(sid, {})
          if sid not in supplier_items:
                supplier_items[sid] = []
                supplier_items[sid].append({
                "product_id":   product["id"],
                "product_name": product["name"],
                "quantity":     item["quantity"],
                "price":        product["price"],
                "unit":         product["unit"],
                "subtotal":     product["price"] * item["quantity"]
            })

    
    orders = []
    now = datetime.now(timezone.utc).isoformat()
    
    for supplier_id, items in supplier_items.items():
        if not items:  # skip if all products were missing from DB
            continue
        supplier = await db.users.find_one({"id": supplier_id}, {"_id": 0})
        subtotal = sum(item["subtotal"] for item in items)
        
        order_id = str(uuid.uuid4())
        order_number = f"AS-{datetime.now().strftime('%Y%m%d')}-{order_id[:8].upper()}"
        
        order_doc = {
            "id": order_id,
            "order_number": order_number,
            "buyer_id": current_user["id"],
            "buyer_name": current_user["full_name"],
            "supplier_id": supplier_id,
            "supplier_name": supplier.get("full_name") if supplier else "Unknown",
            "items": items,
            "subtotal": subtotal,
            "total": subtotal,
            "status": "pending",
            "payment_status": "pending",
            "payment_method": order_data.payment_method,
            "notes": order_data.notes,
            "shipping_address": order_data.shipping_address,
            "shipping_city": order_data.shipping_city,
            "shipping_country": order_data.shipping_country,
            "created_at": now
        }
        
        await db.orders.insert_one(order_doc)
        orders.append(OrderResponse(**order_doc))
    
    # Le panier est vidé uniquement après confirmation du paiement (webhook Stripe / Mobile Money)
    # Ceci évite les commandes fantômes si le paiement échoue
    return orders

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(current_user: dict = Depends(get_current_user), skip: int = 0, limit: int = 50):
    query = {"$or": [{"buyer_id": current_user["id"]}, {"supplier_id": current_user["id"]}]}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return orders

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["buyer_id"] != current_user["id"] and order["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return order

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only supplier can update order status")
    
    valid_statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    return {"message": "Status updated"}

# ======================= PAYMENT ENDPOINTS =======================

@api_router.post("/checkout/session")
@limiter.limit("10/minute")      
async def create_checkout_session(request: CheckoutRequest, http_request: Request, current_user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Calcul du total
    total = 0.0
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            total += product["price"] * item["quantity"]

    total_usd = round(total / 600, 2)  # Conversion XAF to USD
    
    host_url = str(http_request.base_url).rstrip("/")
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": "AfriSupply Order"},
                "unit_amount": int(total_usd * 100),
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{request.origin_url}/checkout?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{request.origin_url}/cart",
        metadata={"user_id": current_user["id"], "cart_total_xaf": str(total)}
    )
    
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "user_id": current_user["id"],
        "amount_usd": total_usd,
        "amount_xaf": total,
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"url": session.url, "session_id": session.id}

@api_router.get("/checkout/status/{session_id}", response_model=PaymentStatusResponse)
async def get_checkout_status(session_id: str, current_user: dict = Depends(get_current_user)):
    session = stripe.checkout.Session.retrieve(session_id, expand=["payment_intent"])
    payment_status = session.payment_status or session.status
    if payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "payment_status": "paid"}}
        )
    return PaymentStatusResponse(status=session.status, payment_status=payment_status, order_id=None)

@api_router.post("/webhook/stripe")
@limiter.limit("5/minute")      
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    
    if not endpoint_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        # Mettre à jour la transaction de paiement
        await db.payment_transactions.update_one(
            {"session_id": session.get("id") or getattr(session, "id", "")},
            {"$set": {"status": "paid", "payment_status": "paid"}}
        )
        # Mettre à jour les commandes de l'utilisateur en attente de paiement
        user_id = session.get("metadata", {}).get("user_id")
        if user_id:
            await db.orders.update_many(
                {
                    "buyer_id": user_id,
                    "payment_status": "pending",
                    "payment_method": "stripe"
                },
                {"$set": {"payment_status": "paid", "status": "confirmed"}}
            )
            # Notifier l'acheteur
            # Vider le panier après paiement confirmé
            await db.carts.update_one(
                {"user_id": user_id},
                {"$set": {"items": []}}
            )
            await create_notification(
                user_id=user_id,
                type="order",
                title="Paiement confirmé",
                message="Votre paiement a été confirmé. Vos commandes sont en cours de traitement.",
                related_id=None
            )
    
    return {"status": "success"}

# ======================= REVIEWS ENDPOINTS =======================

@api_router.get("/products/{product_id}/reviews", response_model=List[ReviewResponse])
@limiter.limit("100/minute")
async def get_product_reviews(request: Request, product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reviews

# ======================= FAVORITES ENDPOINTS =======================

@api_router.post("/favorites/{product_id}")
async def add_favorite(product_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$addToSet": {"favorites": product_id}}
    )
    return {"message": "Added to favorites"}

@api_router.delete("/favorites/{product_id}")
async def remove_favorite(product_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"favorites": product_id}}
    )
    return {"message": "Removed from favorites"}

@api_router.get("/favorites", response_model=List[ProductResponse])
async def get_favorites(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    favorites = user.get("favorites", [])
    if not favorites:
        return []
    products = await db.products.find({"id": {"$in": favorites}}, {"_id": 0}).to_list(200)
    return await _enrich_products(products, db)

# ======================= MESSAGES ENDPOINTS =======================

@api_router.post("/messages", response_model=MessageResponse)
async def send_message(message: MessageCreate, current_user: dict = Depends(get_current_user)):
    receiver = await db.users.find_one({"id": message.receiver_id}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    clean_content = sanitize_string(message.content, 2000)

    # ── Anti-contournement ────────────────────────────────────────────────────
    check = detect_bypass(clean_content)
    if check["blocked"]:
        # Stocker le message original bloqué pour audit, mais envoyer le message système
        msg_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        msg_doc = {
            "id": msg_id,
            "sender_id": "system",
            "sender_name": "AfriSupply",
            "receiver_id": current_user["id"],  # renvoyé à l'expéditeur
            "receiver_name": current_user["full_name"],
            "content": BLOCKED_MESSAGE_TEXT,
            "product_id": message.product_id,
            "is_read": False,
            "is_system": True,
            "created_at": now
        }
        # Logger la tentative de contournement
        await db.bypass_attempts.insert_one({
            "user_id": current_user["id"],
            "target_id": message.receiver_id,
            "original_content": clean_content,
            "reason": check["reason"],
            "created_at": now
        })
        await db.messages.insert_one(msg_doc)
        return MessageResponse(**msg_doc)

    # ── Anonymisation des noms dans le message ────────────────────────────────
    unlocked = await buyer_has_paid_order_with_supplier(
        db, current_user["id"], message.receiver_id
    )
    sender_display = (
        current_user.get("full_name") if unlocked
        else generate_anonymous_id(current_user["id"])
    )
    receiver_display = (
        receiver.get("full_name") if unlocked
        else generate_anonymous_id(message.receiver_id)
    )

    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    msg_doc = {
        "id": msg_id,
        "sender_id": current_user["id"],
        "sender_name": sender_display,
        "receiver_id": message.receiver_id,
        "receiver_name": receiver_display,
        "content": clean_content,
        "product_id": message.product_id,
        "is_read": False,
        "created_at": now
    }

    await db.messages.insert_one(msg_doc)
    return MessageResponse(**msg_doc)

@api_router.get("/messages/conversations", response_model=List[ConversationResponse])
async def get_conversations(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]

    # 1. Récupérer tous les messages de l'utilisateur (tri desc = le plus récent en premier par conv)
    messages = await db.messages.find(
        {"$or": [{"sender_id": uid}, {"receiver_id": uid}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    # 2. Grouper par partenaire — première occurrence = message le plus récent
    conv_map: dict = {}  # partner_id → last_msg
    for msg in messages:
        partner_id = msg["receiver_id"] if msg["sender_id"] == uid else msg["sender_id"]
        if partner_id not in conv_map:
            conv_map[partner_id] = msg

    if not conv_map:
        return []

    partner_ids = list(conv_map.keys())

    # 3. Batch fetch partenaires
    partners_list = await db.users.find({"id": {"$in": partner_ids}}, {"_id": 0}).to_list(200)
    partners_map = {p["id"]: p for p in partners_list}

    # 4. Batch fetch unread counts via aggregation
    unread_pipeline = [
        {"$match": {"receiver_id": uid, "sender_id": {"$in": partner_ids}, "is_read": False}},
        {"$group": {"_id": "$sender_id", "count": {"$sum": 1}}}
    ]
    unread_cursor = db.messages.aggregate(unread_pipeline)
    unread_map = {doc["_id"]: doc["count"] async for doc in unread_cursor}

    # 5. Construire les réponses
    result = []
    for partner_id, last_msg in conv_map.items():
        partner = partners_map.get(partner_id, {})
        result.append(ConversationResponse(
            partner_id=partner_id,
            partner_name=partner.get("full_name", "Unknown"),
            partner_company=partner.get("company_name"),
            last_message=last_msg["content"][:100],
            last_message_time=last_msg["created_at"],
            unread_count=unread_map.get(partner_id, 0)
        ))

    return result

@api_router.get("/messages/{partner_id}", response_model=List[MessageResponse])
async def get_messages(partner_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user["id"], "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": current_user["id"]},
            # Messages système renvoyés à l'utilisateur courant
            {"sender_id": "system", "receiver_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(200)

    # Vérifier si le contact est débloqué (commande payée)
    unlocked = await buyer_has_paid_order_with_supplier(db, current_user["id"], partner_id)

    # Anonymiser les noms si contact non débloqué
    if not unlocked:
        for msg in messages:
            if msg.get("sender_id") not in (current_user["id"], "system"):
                msg["sender_name"] = generate_anonymous_id(msg["sender_id"])
            if msg.get("receiver_id") == partner_id:
                msg["receiver_name"] = generate_anonymous_id(partner_id)

    # Marquer comme lus
    await db.messages.update_many(
        {"sender_id": partner_id, "receiver_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )

    return messages

# ======================= BLOG ENDPOINTS =======================

@api_router.get("/blog", response_model=List[BlogPostResponse])
async def get_blog_posts(category: Optional[str] = None, skip: int = 0, limit: int = 10):
    query = {}
    if category:
        query["category"] = category
    
    posts = await db.blog_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return posts

@api_router.get("/blog/{post_id}", response_model=BlogPostResponse)
async def get_blog_post(post_id: str):
    post = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Increment views
    await db.blog_posts.update_one({"id": post_id}, {"$inc": {"views": 1}})
    post["views"] = post.get("views", 0) + 1
    
    return post

@api_router.post("/blog", response_model=BlogPostResponse)
async def create_blog_post(post: BlogPostCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") not in ["supplier", "admin"]:
        raise HTTPException(status_code=403, detail="Seuls les fournisseurs et admins peuvent publier des articles")
    post_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    post_doc = {
        "id": post_id,
        "author_id": current_user["id"],
        "author_name": current_user["full_name"],
        "views": 0,
        "created_at": now,
        **post.model_dump()
    }
    
    await db.blog_posts.insert_one(post_doc)
    return BlogPostResponse(**post_doc)

# ======================= SUPPLIER RATING ENDPOINTS =======================

@api_router.post("/suppliers/{supplier_id}/rate", response_model=SupplierRatingResponse)
async def rate_supplier(supplier_id: str, rating: SupplierRatingCreate, current_user: dict = Depends(get_current_user)):
    """Rate a supplier after a completed order"""
    if rating.supplier_id != supplier_id:
        raise HTTPException(status_code=400, detail="Supplier ID mismatch")
    
    # Verify order exists and is completed
    order = await db.orders.find_one({
        "id": rating.order_id,
        "buyer_id": current_user["id"],
        "supplier_id": supplier_id,
        "status": "delivered"
    }, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Completed order not found")
    
    # Check if already rated
    existing = await db.supplier_ratings.find_one({
        "order_id": rating.order_id,
        "buyer_id": current_user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this order")
    
    rating_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Calculate overall rating
    overall_rating = (rating.communication_rating + rating.quality_rating + rating.delivery_rating + rating.rating) / 4
    
    rating_doc = {
        "id": rating_id,
        "supplier_id": supplier_id,
        "buyer_id": current_user["id"],
        "buyer_name": current_user["full_name"],
        "order_id": rating.order_id,
        "rating": round(overall_rating, 1),
        "communication_rating": rating.communication_rating,
        "quality_rating": rating.quality_rating,
        "delivery_rating": rating.delivery_rating,
        "comment": rating.comment,
        "created_at": now
    }
    
    await db.supplier_ratings.insert_one(rating_doc)
    
    # Update supplier's average rating
    all_ratings = await db.supplier_ratings.find({"supplier_id": supplier_id}, {"_id": 0}).to_list(500)
    if all_ratings:
        avg_rating = sum(r["rating"] for r in all_ratings) / len(all_ratings)
        avg_comm = sum(r["communication_rating"] for r in all_ratings) / len(all_ratings)
        avg_quality = sum(r["quality_rating"] for r in all_ratings) / len(all_ratings)
        avg_delivery = sum(r["delivery_rating"] for r in all_ratings) / len(all_ratings)
        
        await db.users.update_one(
            {"id": supplier_id},
            {"$set": {
                "supplier_rating": round(avg_rating, 1),
                "rating_count": len(all_ratings),
                "communication_avg": round(avg_comm, 1),
                "quality_avg": round(avg_quality, 1),
                "delivery_avg": round(avg_delivery, 1)
            }}
        )
    
    # Notify supplier
    await create_notification(
        user_id=supplier_id,
        type="review",
        title="Nouvelle évaluation",
        message=f"{current_user['full_name']} vous a attribué une note de {overall_rating:.1f}/5",
        related_id=rating_id
    )
    
    return SupplierRatingResponse(**rating_doc)

@api_router.get("/suppliers/{supplier_id}/ratings", response_model=List[SupplierRatingResponse])
async def get_supplier_ratings(supplier_id: str):
    """Get all ratings for a supplier"""
    ratings = await db.supplier_ratings.find({"supplier_id": supplier_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return ratings

@api_router.get("/suppliers/{supplier_id}/profile", response_model=SupplierProfileResponse)
async def get_supplier_profile(
    supplier_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Get supplier profile — coordonnées masquées avant paiement."""
    supplier = await db.users.find_one({"id": supplier_id, "user_type": "supplier"}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    products_count = await db.products.count_documents({"supplier_id": supplier_id})
    orders_completed = await db.orders.count_documents({"supplier_id": supplier_id, "status": "delivered"})

    # Vérifier si le visiteur a une commande payée avec ce fournisseur
    contact_unlocked = False
    if current_user:
        contact_unlocked = await buyer_has_paid_order_with_supplier(
            db, current_user["id"], supplier_id
        )

    if contact_unlocked:
        display_name = supplier.get("full_name", "")
        company = supplier.get("company_name")
        city = supplier.get("city")
    else:
        display_name = generate_anonymous_id(supplier_id)
        company = None   # masqué
        city = None      # masqué — seul le pays visible

    return SupplierProfileResponse(
        id=supplier["id"],
        full_name=display_name,
        company_name=company,
        country=supplier.get("country"),
        city=city,
        rating=supplier.get("supplier_rating", 0.0),
        rating_count=supplier.get("rating_count", 0),
        communication_avg=supplier.get("communication_avg", 0.0),
        quality_avg=supplier.get("quality_avg", 0.0),
        delivery_avg=supplier.get("delivery_avg", 0.0),
        products_count=products_count,
        orders_completed=orders_completed,
        member_since=supplier["created_at"]
    )

@api_router.get("/suppliers", response_model=List[SupplierProfileResponse])
async def get_suppliers(sort_by: str = "rating", limit: int = 20):
    """Get list of suppliers — batch aggregation pour éviter le N+1"""
    suppliers = await db.users.find({"user_type": "supplier"}, {"_id": 0}).to_list(limit)
    if not suppliers:
        return []

    supplier_ids = [s["id"] for s in suppliers]

    # Batch: compter les produits par fournisseur
    products_pipeline = [
        {"$match": {"supplier_id": {"$in": supplier_ids}}},
        {"$group": {"_id": "$supplier_id", "count": {"$sum": 1}}}
    ]
    products_counts = {doc["_id"]: doc["count"] async for doc in db.products.aggregate(products_pipeline)}

    # Batch: compter les commandes livrées par fournisseur
    orders_pipeline = [
        {"$match": {"supplier_id": {"$in": supplier_ids}, "status": "delivered"}},
        {"$group": {"_id": "$supplier_id", "count": {"$sum": 1}}}
    ]
    orders_counts = {doc["_id"]: doc["count"] async for doc in db.orders.aggregate(orders_pipeline)}

    result = [
        SupplierProfileResponse(
            id=s["id"],
            # Nom/entreprise anonymes dans la liste publique — débloqués après paiement
            full_name=generate_anonymous_id(s["id"]),
            company_name=None,
            country=s.get("country"),
            city=None,  # ville masquée dans la liste
            rating=s.get("supplier_rating", 0.0),
            rating_count=s.get("rating_count", 0),
            communication_avg=s.get("communication_avg", 0.0),
            quality_avg=s.get("quality_avg", 0.0),
            delivery_avg=s.get("delivery_avg", 0.0),
            products_count=products_counts.get(s["id"], 0),
            orders_completed=orders_counts.get(s["id"], 0),
            member_since=s["created_at"]
        )
        for s in suppliers
    ]

    if sort_by == "rating":
        result.sort(key=lambda x: x.rating, reverse=True)

    return result

# ======================= SUPPLIER STATS =======================

@api_router.get("/supplier/stats")
async def get_supplier_stats(current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "supplier":
        raise HTTPException(status_code=403, detail="Only suppliers can access this")
    
    products_count = await db.products.count_documents({"supplier_id": current_user["id"]})
    sid = current_user["id"]
    # Aggregations pour éviter le chargement de tous les documents en mémoire
    order_pipeline = [
        {"$match": {"supplier_id": sid}},
        {"$group": {
            "_id": None,
            "total_orders": {"$sum": 1},
            "pending_orders": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}},
            "completed_orders": {"$sum": {"$cond": [{"$eq": ["$status", "delivered"]}, 1, 0]}},
            "total_revenue": {"$sum": {"$cond": [{"$eq": ["$payment_status", "paid"]}, "$total", 0]}}
        }}
    ]
    order_stats = None
    async for doc in db.orders.aggregate(order_pipeline):
        order_stats = doc

    rfq_pipeline = [
        {"$match": {"supplier_id": sid}},
        {"$group": {
            "_id": None,
            "total_rfqs": {"$sum": 1},
            "pending_rfqs": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}}
        }}
    ]
    rfq_stats = None
    async for doc in db.rfqs.aggregate(rfq_pipeline):
        rfq_stats = doc

    return {
        "products_count": products_count,
        "total_orders": order_stats["total_orders"] if order_stats else 0,
        "pending_orders": order_stats["pending_orders"] if order_stats else 0,
        "completed_orders": order_stats["completed_orders"] if order_stats else 0,
        "total_revenue": order_stats["total_revenue"] if order_stats else 0,
        "pending_rfqs": rfq_stats["pending_rfqs"] if rfq_stats else 0,
        "total_rfqs": rfq_stats["total_rfqs"] if rfq_stats else 0
    }

# ======================= RFQ (REQUEST FOR QUOTE) ENDPOINTS =======================

@api_router.post("/rfq", response_model=RFQResponse)
@limiter.limit("10/minute")
async def create_rfq(request: Request, rfq: RFQCreate, current_user: dict = Depends(get_current_user)):
    """Create a Request for Quote"""
    product = await db.products.find_one({"id": rfq.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    supplier = await db.users.find_one({"id": rfq.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    rfq_id = str(uuid.uuid4())
    rfq_number = f"RFQ-{datetime.now().strftime('%Y%m%d')}-{rfq_id[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    
    # Anti-contournement : scanner notes et specifications
    rfq_notes = rfq.notes or ""
    rfq_specs = rfq.specifications or ""
    for field_text in [rfq_notes, rfq_specs]:
        bypass = detect_bypass(field_text)
        if bypass["blocked"]:
            raise HTTPException(
                status_code=400,
                detail="Votre demande de devis contient des coordonnées personnelles. "
                       "Retirez tout numéro de téléphone, email ou lien externe. "
                       "Les contacts sont partagés automatiquement après paiement."
            )

    rfq_doc = {
        "id": rfq_id,
        "rfq_number": rfq_number,
        "product_id": rfq.product_id,
        "product_name": product["name"],
        "supplier_id": rfq.supplier_id,
        # Fournisseur anonyme pour l'acheteur avant paiement
        "supplier_name": generate_anonymous_id(rfq.supplier_id),
        "supplier_name_real": supplier["full_name"],  # stocké mais masqué
        "buyer_id": current_user["id"],
        # Acheteur anonyme pour le fournisseur avant paiement
        "buyer_name": generate_anonymous_id(current_user["id"]),
        "buyer_name_real": current_user["full_name"],  # stocké mais masqué
        "buyer_company": None,  # masqué
        "quantity": rfq.quantity,
        "target_price": rfq.target_price,
        "quoted_price": None,
        "delivery_location": sanitize_string(rfq.delivery_location, 200),
        "delivery_deadline": rfq.delivery_deadline,
        "specifications": sanitize_string(rfq_specs, 1000) if rfq_specs else None,
        "notes": sanitize_string(rfq_notes, 500) if rfq_notes else None,
        "status": "pending",
        "supplier_response": None,
        "created_at": now,
        "updated_at": None
    }
    
    await db.rfqs.insert_one(rfq_doc)
    
    # Create notification for supplier
    await create_notification(
        user_id=rfq.supplier_id,
        type="rfq",
        title="Nouvelle demande de devis",
        message=f"{current_user['full_name']} a demandé un devis pour {product['name']} (Qté: {rfq.quantity})",
        related_id=rfq_id
    )
    
    return RFQResponse(**rfq_doc)

@api_router.get("/rfq", response_model=List[RFQResponse])
async def get_rfqs(current_user: dict = Depends(get_current_user)):
    """Get all RFQs for current user (as buyer or supplier)"""
    query = {"$or": [{"buyer_id": current_user["id"]}, {"supplier_id": current_user["id"]}]}
    rfqs = await db.rfqs.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return rfqs

@api_router.get("/rfq/{rfq_id}", response_model=RFQResponse)
async def get_rfq(rfq_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific RFQ"""
    rfq = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq["buyer_id"] != current_user["id"] and rfq["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return rfq

@api_router.post("/rfq/{rfq_id}/quote", response_model=RFQResponse)
@limiter.limit("10/minute")
async def submit_quote(request: Request, rfq_id: str, quote: RFQQuote, current_user: dict = Depends(get_current_user)):
    """Supplier submits a quote for an RFQ"""
    rfq = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the supplier can quote this RFQ")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.rfqs.update_one(
        {"id": rfq_id},
        {"$set": {
            "quoted_price": quote.quoted_price,
            "supplier_response": quote.response_notes,
            "status": "quoted",
            "updated_at": now
        }}
    )
    
    # Create notification for buyer
    await create_notification(
        user_id=rfq["buyer_id"],
        type="rfq",
        title="Devis reçu",
        message=f"{current_user['full_name']} a soumis un devis de {quote.quoted_price:,.0f} XAF pour votre demande",
        related_id=rfq_id
    )
    
    updated_rfq = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    return RFQResponse(**updated_rfq)

@api_router.post("/rfq/{rfq_id}/accept")
@limiter.limit("10/minute")
async def accept_quote(request: Request, rfq_id: str, current_user: dict = Depends(get_current_user)):
    """Buyer accepts a quote"""
    rfq = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq["buyer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the buyer can accept this quote")
    if rfq["status"] != "quoted":
        raise HTTPException(status_code=400, detail="Quote not yet submitted")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.rfqs.update_one(
        {"id": rfq_id},
        {"$set": {"status": "accepted", "updated_at": now}}
    )
    
    # Create notification for supplier
    await create_notification(
        user_id=rfq["supplier_id"],
        type="rfq",
        title="Devis accepté",
        message=f"{current_user['full_name']} a accepté votre devis pour {rfq['product_name']}",
        related_id=rfq_id
    )
    
    return {"message": "Quote accepted"}

@api_router.post("/rfq/{rfq_id}/reject")
@limiter.limit("10/minute")
async def reject_quote(request: Request, rfq_id: str, current_user: dict = Depends(get_current_user)):
    """Buyer rejects a quote"""
    rfq = await db.rfqs.find_one({"id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq["buyer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the buyer can reject this quote")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.rfqs.update_one(
        {"id": rfq_id},
        {"$set": {"status": "rejected", "updated_at": now}}
    )
    
    # Create notification for supplier
    await create_notification(
        user_id=rfq["supplier_id"],
        type="rfq",
        title="Devis refusé",
        message=f"{current_user['full_name']} a refusé votre devis pour {rfq['product_name']}",
        related_id=rfq_id
    )
    
    return {"message": "Quote rejected"}

# ======================= MOBILE MONEY ENDPOINTS =======================

@api_router.post("/checkout/mobile-money", response_model=MobileMoneyPaymentResponse)
@limiter.limit("5/minute")      
async def create_mobile_money_payment(
    request: MobileMoneyPaymentRequest, 
    current_user: dict = Depends(get_current_user)
):
    """Create a Mobile Money payment (MOCKED for demo)"""
    cart = await db.carts.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate total
    total = 0.0
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            total += product["price"] * item["quantity"]
    
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Create MOCKED mobile money transaction
    transaction_doc = {
        "id": transaction_id,
        "user_id": current_user["id"],
        "amount": total,
        "currency": "XAF",
        "phone_number": request.phone_number,
        "network": request.network,
        "country_code": request.country_code,
        "status": "pending",
        "payment_type": "mobile_money",
        "created_at": now
    }
    
    await db.payment_transactions.insert_one(transaction_doc)
    
    # Generate payment instruction based on network
    network_instructions = {
        "MTN": f"Composez *126# sur votre téléphone MTN et suivez les instructions pour valider le paiement de {total:,.0f} XAF",
        "Orange": f"Composez #150*1# sur votre Orange Money et validez le paiement de {total:,.0f} XAF",
        "Airtel": f"Composez *500# sur Airtel Money et confirmez le paiement de {total:,.0f} XAF"
    }
    
    return MobileMoneyPaymentResponse(
        transaction_id=transaction_id,
        status="pending",
        amount=total,
        currency="XAF",
        phone_number=request.phone_number,
        network=request.network,
        payment_instruction=network_instructions.get(request.network, "Vérifiez votre téléphone pour valider le paiement"),
        created_at=now
    )

@api_router.post("/checkout/mobile-money/{transaction_id}/confirm")
async def confirm_mobile_money_payment(transaction_id: str, current_user: dict = Depends(get_current_user)):
    """Confirm Mobile Money payment (MOCKED - simulates successful payment)"""
    transaction = await db.payment_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if transaction["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update transaction status (MOCKED as successful)
    await db.payment_transactions.update_one(
        {"id": transaction_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Mettre à jour les commandes en attente (mobile money)
    await db.orders.update_many(
        {
            "buyer_id": current_user["id"],
            "payment_status": "pending",
            "payment_method": "mobile_money"
        },
        {"$set": {"payment_status": "paid", "status": "confirmed"}}
    )

    # Vider le panier après paiement confirmé
    await db.carts.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"items": []}}
    )

    # Notification paiement
    await create_notification(
        user_id=current_user["id"],
        type="order",
        title="Paiement confirmé",
        message=f"Votre paiement Mobile Money de {transaction['amount']:,.0f} XAF a été confirmé. Vos commandes sont en cours de traitement.",
        related_id=transaction_id
    )

    return {"message": "Payment confirmed", "status": "completed"}

# ======================= NOTIFICATIONS ENDPOINTS =======================

async def create_notification(user_id: str, type: str, title: str, message: str, related_id: Optional[str] = None):
    """Helper function to create notifications"""
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "is_read": False,
        "related_id": related_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Log notification (MOCKED email would be sent here)
    logger.info(f"[NOTIFICATION] To: {user_id} | Type: {type} | {title}: {message}")
    
    return notification_doc

@api_router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Get all notifications for current user"""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifications

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    return {"unread_count": count}

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

@api_router.post("/notifications/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

# ======================= ENHANCED REVIEWS ENDPOINTS =======================

@api_router.post("/reviews", response_model=ReviewResponse)
async def create_review(review: ReviewCreate, current_user: dict = Depends(get_current_user)):
    # Verify order exists and belongs to user
    order = await db.orders.find_one({"id": review.order_id, "buyer_id": current_user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if user already reviewed this product in this order
    existing = await db.reviews.find_one({
        "product_id": review.product_id,
        "order_id": review.order_id,
        "user_id": current_user["id"]
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this product")
    
    product = await db.products.find_one({"id": review.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    review_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    review_doc = {
        "id": review_id,
        "product_id": review.product_id,
        "order_id": review.order_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "rating": review.rating,
        "comment": sanitize_string(review.comment, 1000) if review.comment else None,
        "created_at": now
    }
    
    await db.reviews.insert_one(review_doc)
    
    # Update product rating
    reviews = await db.reviews.find({"product_id": review.product_id}, {"_id": 0}).to_list(500)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    await db.products.update_one(
        {"id": review.product_id},
        {"$set": {"rating": round(avg_rating, 1), "review_count": len(reviews)}}
    )
    
    # Notify supplier
    await create_notification(
        user_id=product["supplier_id"],
        type="review",
        title="Nouvel avis",
        message=f"{current_user['full_name']} a laissé un avis {review.rating}/5 sur {product['name']}",
        related_id=review.product_id
    )
    
    return ReviewResponse(**review_doc)

@api_router.get("/reviews/pending", response_model=List[dict])
async def get_pending_reviews(current_user: dict = Depends(get_current_user)):
    """Get products that can be reviewed (from delivered orders without review)"""
    # Get delivered orders
    orders = await db.orders.find({
        "buyer_id": current_user["id"],
        "status": "delivered"
    }, {"_id": 0}).to_list(100)
    
    pending_reviews = []
    for order in orders:
        for item in order.get("items", []):
            # Check if already reviewed
            existing = await db.reviews.find_one({
                "product_id": item["product_id"],
                "order_id": order["id"],
                "user_id": current_user["id"]
            })
            if not existing:
                product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
                if product:
                    pending_reviews.append({
                        "order_id": order["id"],
                        "order_number": order["order_number"],
                        "product_id": item["product_id"],
                        "product_name": item["product_name"],
                        "product_image": product.get("images", [None])[0]
                    })
    
    return pending_reviews


@api_router.get("/contacts/{partner_id}/unlock-status")
async def get_contact_unlock_status(
    partner_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Vérifie si le contact d'un partenaire est débloqué pour l'utilisateur courant.
    Retourne les coordonnées réelles si une commande payée existe.
    """
    partner = await db.users.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partenaire introuvable")

    info = await get_contact_info_if_unlocked(db, current_user["id"], partner)
    return info


# ── Bypass attempts — admin only ─────────────────────────────────────────────
# Remplacer l'endpoint /bypass-attempts/mine existant :
@api_router.get("/admin/bypass-attempts")
async def admin_bypass_attempts(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins uniquement")
    attempts = await db.bypass_attempts.find({}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return attempts

# ═══════════════════════════════════════════════════════════════════════════════
## ADD — INVOICE PDF ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

def _build_invoice_pdf(order: dict, buyer: dict, supplier_name: str) -> bytes:
    """Génère une facture PDF professionnelle pour une commande payée."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from io import BytesIO
    from datetime import datetime, timezone

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm, topMargin=15*mm, bottomMargin=15*mm)

    styles = getSampleStyleSheet()
    PRIMARY = colors.HexColor("#034168")
    ACCENT  = colors.HexColor("#FF6A00")
    LIGHT   = colors.HexColor("#F0F4F8")

    body  = ParagraphStyle("body",  parent=styles["Normal"], fontSize=9, leading=13, textColor=colors.HexColor("#333333"))
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=7.5, textColor=colors.HexColor("#666666"))
    bold  = ParagraphStyle("bold",  parent=styles["Normal"], fontSize=9, fontName="Helvetica-Bold", textColor=PRIMARY)
    title = ParagraphStyle("title", parent=styles["Heading1"], fontSize=14, textColor=PRIMARY, fontName="Helvetica-Bold")

    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    story   = []

    # ── En-tête ──────────────────────────────────────────────────────────────
    hdr = Table([[
        Paragraph('<font color="#034168" size="14"><b>AfriSupply</b></font><br/>'
                  '<font color="#888888" size="8">Marketplace B2B Industrielle — Zone CEMAC</font>', body),
        Paragraph(f'<font color="#FF6A00" size="12"><b>FACTURE</b></font><br/>'
                  f'<font color="#666666" size="8">N° {order.get("order_number","")}</font><br/>'
                  f'<font color="#999999" size="7">Émise le {now_str}</font>',
                  ParagraphStyle("r", parent=body, alignment=2)),
    ]], colWidths=[95*mm, 75*mm])
    hdr.setStyle(TableStyle([
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("LINEBELOW",  (0,0), (-1,-1), 1.5, ACCENT),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    story.append(hdr)
    story.append(Spacer(1, 6*mm))

    # ── Parties ──────────────────────────────────────────────────────────────
    parties = Table([[
        Paragraph(f"<b>VENDEUR</b><br/>{supplier_name}<br/>Via AfriSupply", body),
        Paragraph(f"<b>ACHETEUR</b><br/>{buyer.get('full_name','')}<br/>"
                  f"{buyer.get('company_name','')}<br/>{buyer.get('city','')}, {buyer.get('country','')}", body),
    ]], colWidths=[85*mm, 85*mm])
    parties.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), LIGHT),
        ("GRID",          (0,0), (-1,-1), 0.3, colors.white),
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
    ]))
    story.append(parties)
    story.append(Spacer(1, 6*mm))

    # ── Tableau articles ─────────────────────────────────────────────────────
    headers = [["Désignation", "Qté", "Unité", "PU (XAF)", "Total (XAF)"]]
    rows = []
    for item in order.get("items", []):
        rows.append([
            Paragraph(item.get("product_name", ""), body),
            str(item.get("quantity", "")),
            item.get("unit", ""),
            f"{item.get('price', 0):,.0f}",
            f"{item.get('subtotal', 0):,.0f}",
        ])

    items_table = Table(
        [[Paragraph(h, ParagraphStyle("th", parent=body, fontName="Helvetica-Bold", textColor=colors.white)) for h in headers[0]]] + rows,
        colWidths=[80*mm, 18*mm, 18*mm, 27*mm, 27*mm]
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), PRIMARY),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, colors.HexColor("#CCCCCC")),
        ("ALIGN",         (1,0), (-1,-1), "CENTER"),
        ("ALIGN",         (3,0), (-1,-1), "RIGHT"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 5),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 4*mm))

    # ── Total ─────────────────────────────────────────────────────────────────
    total_tbl = Table([[
        "",
        Paragraph(f"<b>TOTAL HT : {order.get('total', 0):,.0f} XAF</b>",
                  ParagraphStyle("tot", parent=body, fontName="Helvetica-Bold", fontSize=11, textColor=PRIMARY, alignment=2))
    ]], colWidths=[110*mm, 60*mm])
    story.append(total_tbl)
    story.append(Spacer(1, 6*mm))

    # ── Pied ─────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CCCCCC")))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        f"Facture générée par AfriSupply — Marketplace B2B Zone CEMAC. "
        f"Document non contractuel — Référence commande : {order.get('order_number','')} — Paiement : {order.get('payment_method','').upper()}",
        small
    ))

    doc.build(story)
    return buffer.getvalue()


@api_router.get("/orders/{order_id}/invoice")
@limiter.limit("10/minute")
async def get_order_invoice(
    request: Request,
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Génère et retourne la facture PDF d'une commande payée."""
    from starlette.responses import Response as StarletteResponse

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["buyer_id"] != current_user["id"] and order["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Facture disponible uniquement pour les commandes payées")

    buyer    = await db.users.find_one({"id": order["buyer_id"]}, {"_id": 0}) or {}
    supplier = await db.users.find_one({"id": order["supplier_id"]}, {"_id": 0}) or {}
    supplier_name = supplier.get("company_name") or supplier.get("full_name") or "Fournisseur AfriSupply"

    pdf_bytes = _build_invoice_pdf(order, buyer, supplier_name)
    filename  = f"Facture_AfriSupply_{order.get('order_number','').replace('-','_')}.pdf"

    return StarletteResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ======================= FICHE PRODUIT INDUSTRIELLE =======================

PRODUCT_SHEET_DIR = Path("uploads/product_sheets")
PRODUCT_SHEET_DIR.mkdir(parents=True, exist_ok=True)


def _build_product_sheet_pdf(product: dict, supplier: dict, include_supplier_id: bool) -> bytes:
    """
    Génère une fiche produit industrielle conforme aux standards B2B
    (compatible validation TotalEnergies, PERENCO, sociétés BTP, etc.)
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=15*mm, bottomMargin=15*mm,
        title=f"Fiche Produit — {product.get('name', '')}",
        author="AfriSupply",
        subject="Fiche technique industrielle",
    )

    styles = getSampleStyleSheet()
    PRIMARY = colors.HexColor("#034168")
    ACCENT  = colors.HexColor("#FF6A00")
    LIGHT   = colors.HexColor("#F0F4F8")

    title_style = ParagraphStyle(
        "Title", parent=styles["Heading1"],
        fontSize=16, textColor=PRIMARY, spaceAfter=4,
        fontName="Helvetica-Bold",
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"],
        fontSize=10, textColor=colors.white,
        fontName="Helvetica-Bold", spaceAfter=0, spaceBefore=0,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=9, leading=14, textColor=colors.HexColor("#333333"),
    )
    small_style = ParagraphStyle(
        "Small", parent=styles["Normal"],
        fontSize=7.5, textColor=colors.HexColor("#666666"),
    )
    label_style = ParagraphStyle(
        "Label", parent=styles["Normal"],
        fontSize=8.5, fontName="Helvetica-Bold", textColor=PRIMARY,
    )

    def section_header(text):
        tbl = Table([[Paragraph(f"  {text}", section_style)]], colWidths=[170*mm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), PRIMARY),
            ("TOPPADDING",    (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ]))
        return tbl

    def kv_table(rows, col_w=(70, 100)):
        data = []
        for label, value in rows:
            data.append([
                Paragraph(label, label_style),
                Paragraph(str(value) if value not in (None, "") else "N/A", body_style),
            ])
        tbl = Table(data, colWidths=[c*mm for c in col_w])
        tbl.setStyle(TableStyle([
            ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, LIGHT]),
            ("GRID",    (0,0), (-1,-1), 0.3, colors.HexColor("#CCCCCC")),
            ("VALIGN",  (0,0), (-1,-1), "TOP"),
            ("TOPPADDING",    (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ]))
        return tbl

    story = []
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    # ── EN-TÊTE ───────────────────────────────────────────────────────────────
    header_data = [[
        Paragraph(
            f'<font color="#034168" size="14"><b>AfriSupply</b></font><br/>'
            f'<font color="#666666" size="8">Marketplace B2B Industrielle — Zone CEMAC</font>',
            body_style
        ),
        Paragraph(
            f'<font color="#FF6A00" size="11"><b>FICHE PRODUIT</b></font><br/>'
            f'<font color="#666666" size="7">Document de référence — Usage professionnel</font><br/>'
            f'<font color="#999999" size="7">Émise le {now_str}</font>',
            ParagraphStyle("right", parent=body_style, alignment=2)
        ),
    ]]
    hdr_tbl = Table(header_data, colWidths=[95*mm, 75*mm])
    hdr_tbl.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LINEBELOW", (0,0), (-1,-1), 1.5, ACCENT),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    story.append(hdr_tbl)
    story.append(Spacer(1, 6*mm))

    # ── DÉSIGNATION PRODUIT ───────────────────────────────────────────────────
    story.append(Paragraph(product.get("name", "Produit sans nom"), title_style))
    if product.get("description"):
        story.append(Paragraph(product["description"][:500], body_style))
    story.append(Spacer(1, 4*mm))

    # ── IDENTIFICATION ────────────────────────────────────────────────────────
    story.append(section_header("1. IDENTIFICATION DU PRODUIT"))
    story.append(Spacer(1, 1*mm))
    id_rows = [
        ("Référence AfriSupply",  product.get("id", "")[:16].upper()),
        ("Désignation",           product.get("name", "")),
        ("Catégorie",             product.get("category_name", "N/A")),
        ("Unité de vente",        product.get("unit", "N/A")),
        ("Qté min. commande",     f"{product.get('min_order_quantity', 1)} {product.get('unit', '')}"),
        ("Stock disponible",      f"{product.get('stock_quantity', 0)} {product.get('unit', '')}"),
        ("Prix unitaire (XAF)",   f"{product.get('price', 0):,.0f} XAF HT"),
        ("Disponibilité",         "✓ En stock" if product.get("is_available") else "✗ Rupture"),
    ]
    story.append(kv_table(id_rows))
    story.append(Spacer(1, 4*mm))

    # ── SPÉCIFICATIONS TECHNIQUES ─────────────────────────────────────────────
    specs = product.get("specifications") or {}
    story.append(section_header("2. SPÉCIFICATIONS TECHNIQUES"))
    story.append(Spacer(1, 1*mm))
    if isinstance(specs, dict) and specs:
        spec_rows = [(k.replace("_", " ").title(), v) for k, v in specs.items()]
        story.append(kv_table(spec_rows))
    else:
        story.append(Paragraph(
            "Spécifications détaillées disponibles sur demande auprès du fournisseur via AfriSupply.",
            ParagraphStyle("italic", parent=body_style, textColor=colors.HexColor("#888888"))
        ))
    story.append(Spacer(1, 4*mm))

    # ── INFORMATIONS FOURNISSEUR ──────────────────────────────────────────────
    story.append(section_header("3. INFORMATIONS FOURNISSEUR"))
    story.append(Spacer(1, 1*mm))
    if include_supplier_id:
        supplier_rows = [
            ("Fournisseur",       supplier.get("company_name") or supplier.get("full_name", "")),
            ("Pays",              supplier.get("country", "N/A")),
            ("Ville",             supplier.get("city", "N/A")),
            ("Statut",            "✓ Fournisseur vérifié AfriSupply"),
            ("Commande via",      "afrisupply.com — Messagerie interne sécurisée"),
        ]
    else:
        supplier_rows = [
            ("Fournisseur",       generate_anonymous_id(product.get("supplier_id", ""))),
            ("Pays",              supplier.get("country", "N/A")),
            ("Statut",            "✓ Fournisseur vérifié AfriSupply"),
            ("Contact",           "Via plateforme AfriSupply uniquement"),
        ]
    story.append(kv_table(supplier_rows))
    story.append(Spacer(1, 4*mm))

    # ── CONDITIONS COMMERCIALES ───────────────────────────────────────────────
    story.append(section_header("4. CONDITIONS COMMERCIALES"))
    story.append(Spacer(1, 1*mm))
    comm_rows = [
        ("Paiement acceptés",  "Mobile Money (MTN, Orange, Airtel) • Carte bancaire (Visa/MC)"),
        ("Zone de livraison",  "Cameroun, Gabon, Congo, Tchad, Guinée Équatoriale, Centrafrique"),
        ("Demande de devis",   "Disponible via AfriSupply (RFQ en 24h)"),
        ("Retours / Litiges",  "Selon conditions générales AfriSupply — support@afrisupply.com"),
        ("Devise",             "XAF (Franc CFA CEMAC) — Prix HT"),
    ]
    story.append(kv_table(comm_rows))
    story.append(Spacer(1, 4*mm))

    # ── AVIS & NOTATION ───────────────────────────────────────────────────────
    if product.get("rating", 0) > 0:
        story.append(section_header("5. ÉVALUATION ACHETEURS"))
        story.append(Spacer(1, 1*mm))
        stars = "★" * round(product["rating"]) + "☆" * (5 - round(product["rating"]))
        rating_rows = [
            ("Note globale",    f"{product['rating']:.1f} / 5  {stars}"),
            ("Nombre d'avis",   str(product.get("review_count", 0))),
        ]
        story.append(kv_table(rating_rows))
        story.append(Spacer(1, 4*mm))

    # ── PIED DE PAGE ──────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CCCCCC")))
    story.append(Spacer(1, 2*mm))
    disclaimer = (
        "Ce document est généré automatiquement par AfriSupply — Marketplace B2B Industrielle Zone CEMAC. "
        "Les informations contenues sont fournies à titre indicatif. AfriSupply garantit la vérification "
        "des fournisseurs référencés mais décline toute responsabilité sur les spécifications techniques "
        "qui relèvent de la responsabilité du fabricant. Document non contractuel. "
        f"Référence : AS-PS-{product.get('id', '')[:8].upper()} — {now_str}"
    )
    story.append(Paragraph(disclaimer, small_style))

    doc.build(story)
    return buffer.getvalue()


@api_router.get("/products/{product_id}/sheet")
@limiter.limit("20/minute")
async def get_product_sheet(
    request: Request,
    product_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """
    Génère et retourne la fiche produit industrielle au format PDF.
    - Utilisateur non connecté ou sans commande : fournisseur anonymisé
    - Utilisateur avec commande payée : nom fournisseur visible (pas coordonnées)
    """
    from fastapi.responses import Response as FastAPIResponse

    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")

    supplier = await db.users.find_one({"id": product.get("supplier_id")}, {"_id": 0}) or {}
    category = await db.categories.find_one({"id": product.get("category_id")}, {"_id": 0}) or {}
    product["category_name"] = category.get("name")

    # Vérifier si l'utilisateur a une commande payée avec ce fournisseur
    include_supplier_id = False
    if current_user:
        include_supplier_id = await buyer_has_paid_order_with_supplier(
            db, current_user["id"], product.get("supplier_id", "")
        )

    # Générer le PDF
    pdf_bytes = _build_product_sheet_pdf(product, supplier, include_supplier_id)

    # Nom de fichier propre
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", product.get("name", "produit"))[:40]
    filename = f"AfriSupply_FicheProduit_{safe_name}_{product_id[:8].upper()}.pdf"

    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ======================= WEBSOCKET FOR CHAT =======================

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.rate_limits: Dict[str, dict] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/chat/{token}")
async def websocket_chat(websocket: WebSocket, token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return
    
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                receiver_id = data.get("receiver_id")
                raw_content = data.get("content", "")
                content = sanitize_string(str(raw_content), 2000) if raw_content else ""
                if not content:
                    continue

                # ── Anti-contournement WS ─────────────────────────────────
                bypass_check = detect_bypass(content)
                user = await db.users.find_one({"id": user_id}, {"_id": 0})
                receiver = await db.users.find_one({"id": receiver_id}, {"_id": 0})

                if bypass_check["blocked"]:
                    now_b = datetime.now(timezone.utc).isoformat()
                    block_msg = {
                        "id": str(uuid.uuid4()),
                        "sender_id": "system",
                        "sender_name": "AfriSupply",
                        "receiver_id": user_id,
                        "receiver_name": user.get("full_name", "") if user else "",
                        "content": BLOCKED_MESSAGE_TEXT,
                        "is_read": False,
                        "is_system": True,
                        "created_at": now_b,
                    }
                    await db.bypass_attempts.insert_one({
                        "user_id": user_id,
                        "target_id": receiver_id,
                        "original_content": content,
                        "reason": "ws_bypass",
                        "created_at": now_b,
                    })
                    await db.messages.insert_one(block_msg)
                    await websocket.send_json({"type": "blocked", "message": block_msg})
                    continue

                if receiver and user:
                    # Anonymisation selon statut paiement
                    unlocked = await buyer_has_paid_order_with_supplier(db, user_id, receiver_id)
                    sender_display = user.get("full_name", "") if unlocked else generate_anonymous_id(user_id)
                    receiver_display = receiver.get("full_name", "") if unlocked else generate_anonymous_id(receiver_id)

                    msg_id = str(uuid.uuid4())
                    now = datetime.now(timezone.utc).isoformat()

                    msg_doc = {
                        "id": msg_id,
                        "sender_id": user_id,
                        "sender_name": sender_display,
                        "receiver_id": receiver_id,
                        "receiver_name": receiver_display,
                        "content": content,
                        "is_read": False,
                        "created_at": now,
                    }

                    await db.messages.insert_one(msg_doc)
                    await manager.send_personal_message(msg_doc, receiver_id)
                    await websocket.send_json({"type": "sent", "message": msg_doc})
    
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# ======================= HEALTH & ROOT =======================

@api_router.get("/")
async def root():
    return {"message": "AfriSupply API - B2B Industrial Marketplace for Central Africa"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ======================= SEED DATA =======================

@api_router.post("/seed")
async def seed_data():
    """Seed initial categories and sample data — disabled in production"""
    if os.environ.get("ENVIRONMENT", "development").lower() != "development":
        raise HTTPException(status_code=403, detail="Seed disabled in production")
    
    # Check if already seeded — on vérifie les PRODUITS au lieu des catégories
    existing = await db.products.count_documents({})
    if existing > 0:
        return {"message": "Data already seeded"}
    
    categories = [
        {
            "id": str(uuid.uuid4()),
            "name": "Construction Métallique",
            "name_en": "Metal Construction",
            "description": "Structures métalliques, charpentes, portails et équipements en acier",
            "description_en": "Metal structures, frameworks, gates and steel equipment",
            "icon": "Wrench",
            "image_url": "https://images.pexels.com/photos/6509862/pexels-photo-6509862.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Construction BTP",
            "name_en": "Building & Construction",
            "description": "Matériaux de construction, ciment, équipements de chantier",
            "description_en": "Construction materials, cement, site equipment",
            "icon": "HardHat",
            "image_url": "https://images.pexels.com/photos/3862384/pexels-photo-3862384.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Maintenance Industrielle",
            "name_en": "Industrial Maintenance",
            "description": "Pièces détachées, outillage, équipements de maintenance",
            "description_en": "Spare parts, tools, maintenance equipment",
            "icon": "Gear",
            "image_url": "https://images.unsplash.com/photo-1576666735112-87a8ea71671c?crop=entropy&cs=srgb&fm=jpg&q=85"
        }
    ]
    
    await db.categories.insert_many(categories)
    
    # Create sample supplier
    supplier_id = str(uuid.uuid4())
    supplier = {
        "id": supplier_id,
        "email": "supplier@afrisupply.com",
        "full_name": "Jean-Pierre Mbongo",
        "company_name": "Acier Plus SARL",
        "phone": "+237 690 000 000",
        "country": "Cameroun",
        "city": "Douala",
        "user_type": "supplier",
        "password_hash": get_password_hash("supplier123"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "favorites": [],
        "viewed_products": []
    }
    await db.users.insert_one(supplier)
    print("Supplier inséré avec succès")
    
    # Create sample buyer
    buyer_id = str(uuid.uuid4())
    buyer = {
        "id": buyer_id,
        "email": "buyer@afrisupply.com",
        "full_name": "Marie Ndong",
        "company_name": "Constructions Gabon SA",
        "phone": "+241 66 000 000",
        "country": "Gabon",
        "city": "Libreville",
        "user_type": "buyer",
        "password_hash": get_password_hash("buyer123"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "favorites": [],
        "viewed_products": []
    }
    await db.users.insert_one(buyer)
    print("Buyer inséré avec succès")
    
    # Create sample products
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Poutrelles IPE 200",
            "name_en": "IPE 200 Steel Beams",
            "description": "Poutrelles en acier IPE 200, longueur 12m, qualité S235JR. Idéal pour structures de bâtiments industriels.",
            "description_en": "IPE 200 steel beams, 12m length, S235JR quality. Ideal for industrial building structures.",
            "category_id": categories[0]["id"],
            "supplier_id": supplier_id,
            "price": 125000.0,
            "min_order_quantity": 10,
            "unit": "pièce",
            "stock_quantity": 500,
            "specifications": {"longueur": "12m", "qualite": "S235JR", "poids": "26.2 kg/m"},
            "images": ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800"],
            "is_available": True,
            "rating": 4.5,
            "review_count": 12,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ciment Portland CEM I 42.5",
            "name_en": "Portland Cement CEM I 42.5",
            "description": "Ciment Portland haute résistance, sac de 50kg. Conforme aux normes CEMAC.",
            "description_en": "High resistance Portland cement, 50kg bag. Compliant with CEMAC standards.",
            "category_id": categories[1]["id"],
            "supplier_id": supplier_id,
            "price": 5500.0,
            "min_order_quantity": 100,
            "unit": "sac",
            "stock_quantity": 10000,
            "specifications": {"poids": "50kg", "classe": "42.5N", "norme": "EN 197-1"},
            "images": ["https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800"],
            "is_available": True,
            "rating": 4.8,
            "review_count": 45,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Groupe Électrogène 100 KVA",
            "name_en": "100 KVA Generator Set",
            "description": "Groupe électrogène diesel 100 KVA, démarrage automatique, insonorisé.",
            "description_en": "100 KVA diesel generator set, automatic start, soundproof.",
            "category_id": categories[2]["id"],
            "supplier_id": supplier_id,
            "price": 8500000.0,
            "min_order_quantity": 1,
            "unit": "unité",
            "stock_quantity": 15,
            "specifications": {"puissance": "100 KVA", "carburant": "Diesel", "autonomie": "8h"},
            "images": ["https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800"],
            "is_available": True,
            "rating": 4.9,
            "review_count": 8,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Tôles Ondulées Galvanisées",
            "name_en": "Galvanized Corrugated Sheets",
            "description": "Tôles ondulées galvanisées, épaisseur 0.5mm, longueur 3m. Protection anticorrosion.",
            "description_en": "Galvanized corrugated sheets, 0.5mm thickness, 3m length. Anti-corrosion protection.",
            "category_id": categories[0]["id"],
            "supplier_id": supplier_id,
            "price": 15000.0,
            "min_order_quantity": 50,
            "unit": "feuille",
            "stock_quantity": 2000,
            "specifications": {"epaisseur": "0.5mm", "longueur": "3m", "largeur": "0.9m"},
            "images": ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"],
            "is_available": True,
            "rating": 4.3,
            "review_count": 23,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Bétonnière 350L",
            "name_en": "350L Concrete Mixer",
            "description": "Bétonnière professionnelle 350 litres, moteur diesel, châssis renforcé.",
            "description_en": "Professional 350 liter concrete mixer, diesel engine, reinforced chassis.",
            "category_id": categories[1]["id"],
            "supplier_id": supplier_id,
            "price": 1200000.0,
            "min_order_quantity": 1,
            "unit": "unité",
            "stock_quantity": 25,
            "specifications": {"capacite": "350L", "moteur": "Diesel 10HP", "poids": "280kg"},
            "images": ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800"],
            "is_available": True,
            "rating": 4.6,
            "review_count": 15,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Compresseur d'Air 500L",
            "name_en": "500L Air Compressor",
            "description": "Compresseur d'air industriel 500 litres, 10 bars, triphasé.",
            "description_en": "Industrial air compressor 500 liters, 10 bars, three-phase.",
            "category_id": categories[2]["id"],
            "supplier_id": supplier_id,
            "price": 2800000.0,
            "min_order_quantity": 1,
            "unit": "unité",
            "stock_quantity": 10,
            "specifications": {"capacite": "500L", "pression": "10 bars", "debit": "800 L/min"},
            "images": ["https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800"],
            "is_available": True,
            "rating": 4.7,
            "review_count": 6,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.products.insert_many(products)
    print("Produits insérés :", len(products))
    
    # Create sample blog post
    blog_post = {
        "id": str(uuid.uuid4()),
        "title": "L'industrie de la construction en Afrique centrale : tendances 2025",
        "title_en": "Construction Industry in Central Africa: 2025 Trends",
        "content": "Le secteur de la construction en Afrique centrale connaît une croissance significative...",
        "content_en": "The construction sector in Central Africa is experiencing significant growth...",
        "excerpt": "Découvrez les principales tendances du secteur de la construction en zone CEMAC.",
        "excerpt_en": "Discover the main trends in the construction sector in the CEMAC zone.",
        "image_url": "https://images.pexels.com/photos/236698/pexels-photo-236698.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "category": "Industrie",
        "tags": ["construction", "CEMAC", "tendances", "2025"],
        "author_id": supplier_id,
        "author_name": "Jean-Pierre Mbongo",
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.blog_posts.insert_one(blog_post)
    print("Blog post inséré")
    
    return {"message": "Data seeded successfully", "categories": len(categories), "products": len(products)}

# Include the router in the main app
app.include_router(api_router)

# ======================= MIDDLEWARES SÉCURITÉ =======================

# CORS — restreindre aux origines connues en production
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://afrisupply.com,https://www.afrisupply.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Client-Version"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
    max_age=600,
)

app.add_middleware(SecurityHeadersMiddleware)

@app.on_event("startup")
async def startup_db_indexes():
    """Créer les index MongoDB au démarrage pour optimiser les performances."""
    await db.products.create_index([("is_available", 1), ("rating", -1)])
    await db.products.create_index([("category_id", 1)])
    await db.products.create_index([("supplier_id", 1)])
    await db.products.create_index([("created_at", -1)])
    await db.products.create_index([("name", "text"), ("name_en", "text"), ("description", "text")])
    await db.orders.create_index([("buyer_id", 1), ("created_at", -1)])
    await db.orders.create_index([("supplier_id", 1), ("created_at", -1)])
    await db.orders.create_index([("status", 1)])
    await db.notifications.create_index([("user_id", 1), ("is_read", 1)])
    await db.messages.create_index([("sender_id", 1), ("receiver_id", 1), ("created_at", 1)])
    await db.reviews.create_index([("product_id", 1)])
    await db.rfqs.create_index([("buyer_id", 1), ("supplier_id", 1)])
    await db.bypass_attempts.create_index([("user_id", 1), ("created_at", -1)])
    await db.carts.create_index([("user_id", 1)])
    await db.users.create_index([("email", 1)], unique=True, sparse=True)
    await db.users.create_index([("user_type", 1)])
    await db.products.create_index([("is_available", 1), ("category_id", 1), ("rating", -1)])
    await db.orders.create_index([("buyer_id", 1), ("payment_status", 1)])
    await db.orders.create_index([("supplier_id", 1), ("status", 1)])
    await db.messages.create_index([("receiver_id", 1), ("is_read", 1)])
    await db.rfqs.create_index([("status", 1), ("created_at", -1)])
    await db.supplier_ratings.create_index([("supplier_id", 1)])
    await db.reviews.create_index([("product_id", 1), ("user_id", 1)])
    await db.blog_posts.create_index([("created_at", -1)])
    await db.order_tracking.create_index([("order_id", 1), ("created_at", 1)])
    await db.order_tracking.create_index([("created_at", -1)])
    logger.info("MongoDB indexes created — total: 25")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()