from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
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
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'afrisupply_secret_key')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 1440))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="AfriSupply API", description="B2B Industrial Marketplace for Central Africa")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ======================= MODELS =======================

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

class TokenResponse(BaseModel):
    access_token: str
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
    description: str
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
    quantity: int

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
    notes: Optional[str] = None
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

# ======================= AUTH HELPERS =======================

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

# ======================= AUTH ENDPOINTS =======================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
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
    
    token = create_access_token({"sub": user_id})
    user_response = UserResponse(
        id=user_id, email=user_data.email, full_name=user_data.full_name,
        company_name=user_data.company_name, phone=user_data.phone,
        country=user_data.country, city=user_data.city,
        user_type=user_data.user_type, created_at=now
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["id"]})
    user_response = UserResponse(
        id=user["id"], email=user["email"], full_name=user["full_name"],
        company_name=user.get("company_name"), phone=user.get("phone"),
        country=user.get("country"), city=user.get("city"),
        user_type=user["user_type"], created_at=user["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"], email=current_user["email"],
        full_name=current_user["full_name"],
        company_name=current_user.get("company_name"),
        phone=current_user.get("phone"), country=current_user.get("country"),
        city=current_user.get("city"), user_type=current_user["user_type"],
        created_at=current_user["created_at"]
    )

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

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products(
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
    query = {}
    if category_id:
        query["category_id"] = category_id
    if supplier_id:
        query["supplier_id"] = supplier_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"name_en": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    if is_available is not None:
        query["is_available"] = is_available
    
    sort_direction = -1 if sort_order == "desc" else 1
    products = await db.products.find(query, {"_id": 0}).sort(sort_by, sort_direction).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with category and supplier info
    for product in products:
        category = await db.categories.find_one({"id": product.get("category_id")}, {"_id": 0})
        supplier = await db.users.find_one({"id": product.get("supplier_id")}, {"_id": 0})
        product["category_name"] = category.get("name") if category else None
        product["supplier_name"] = supplier.get("full_name") if supplier else None
        product["supplier_company"] = supplier.get("company_name") if supplier else None
    
    return products

@api_router.get("/products/popular", response_model=List[ProductResponse])
async def get_popular_products(limit: int = 8):
    products = await db.products.find({"is_available": True}, {"_id": 0}).sort("rating", -1).limit(limit).to_list(limit)
    for product in products:
        category = await db.categories.find_one({"id": product.get("category_id")}, {"_id": 0})
        supplier = await db.users.find_one({"id": product.get("supplier_id")}, {"_id": 0})
        product["category_name"] = category.get("name") if category else None
        product["supplier_name"] = supplier.get("full_name") if supplier else None
        product["supplier_company"] = supplier.get("company_name") if supplier else None
    return products

@api_router.get("/products/recommendations", response_model=List[ProductResponse])
async def get_recommendations(current_user: dict = Depends(get_current_user)):
    """AI-powered product recommendations based on user history"""
    try:
        viewed = current_user.get("viewed_products", [])[-10:]
        favorites = current_user.get("favorites", [])
        
        # Get user's viewed and favorite products for context
        context_products = []
        for pid in (viewed + favorites)[:5]:
            product = await db.products.find_one({"id": pid}, {"_id": 0, "name": 1, "category_id": 1})
            if product:
                context_products.append(product.get("name", ""))
        
        # Use AI to generate recommendations
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if api_key and context_products:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"rec_{current_user['id']}",
                system_message="You are a B2B product recommendation assistant for an industrial marketplace in Central Africa. Respond only with category IDs."
            ).with_model("openai", "gpt-5.2")
            
            categories = await db.categories.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(10)
            cat_list = ", ".join([f"{c['id']}:{c['name']}" for c in categories])
            
            user_msg = UserMessage(text=f"User viewed: {', '.join(context_products)}. Categories: {cat_list}. Return 2 most relevant category IDs separated by comma.")
            response = await chat.send_message(user_msg)
            
            rec_cat_ids = [cid.strip() for cid in response.split(",")][:2]
            products = await db.products.find(
                {"category_id": {"$in": rec_cat_ids}, "is_available": True},
                {"_id": 0}
            ).limit(8).to_list(8)
        else:
            # Fallback to popular products
            products = await db.products.find({"is_available": True}, {"_id": 0}).sort("rating", -1).limit(8).to_list(8)
        
        for product in products:
            category = await db.categories.find_one({"id": product.get("category_id")}, {"_id": 0})
            supplier = await db.users.find_one({"id": product.get("supplier_id")}, {"_id": 0})
            product["category_name"] = category.get("name") if category else None
            product["supplier_name"] = supplier.get("full_name") if supplier else None
            product["supplier_company"] = supplier.get("company_name") if supplier else None
        
        return products
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        products = await db.products.find({"is_available": True}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
        return products

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, current_user: dict = Depends(get_current_user_optional)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    category = await db.categories.find_one({"id": product.get("category_id")}, {"_id": 0})
    supplier = await db.users.find_one({"id": product.get("supplier_id")}, {"_id": 0})
    product["category_name"] = category.get("name") if category else None
    product["supplier_name"] = supplier.get("full_name") if supplier else None
    product["supplier_company"] = supplier.get("company_name") if supplier else None
    
    # Track view for logged-in users
    if current_user:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$addToSet": {"viewed_products": product_id}}
        )
    
    return product

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "supplier":
        raise HTTPException(status_code=403, detail="Only suppliers can create products")
    
    product_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    product_doc = {
        "id": product_id,
        "supplier_id": current_user["id"],
        "rating": 0.0,
        "review_count": 0,
        "created_at": now,
        **product.model_dump()
    }
    
    await db.products.insert_one(product_doc)
    
    category = await db.categories.find_one({"id": product.category_id}, {"_id": 0})
    
    return ProductResponse(
        id=product_id,
        supplier_id=current_user["id"],
        supplier_name=current_user["full_name"],
        supplier_company=current_user.get("company_name"),
        category_name=category.get("name") if category else None,
        rating=0.0,
        review_count=0,
        created_at=now,
        **product.model_dump()
    )

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    if existing["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your product")
    
    update_data = {k: v for k, v in product.model_dump().items() if v is not None}
    if update_data:
        await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    category = await db.categories.find_one({"id": updated.get("category_id")}, {"_id": 0})
    updated["category_name"] = category.get("name") if category else None
    updated["supplier_name"] = current_user["full_name"]
    updated["supplier_company"] = current_user.get("company_name")
    
    return updated

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    if existing["supplier_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your product")
    
    await db.products.delete_one({"id": product_id})
    return {"message": "Product deleted"}

@api_router.get("/supplier/products", response_model=List[ProductResponse])
async def get_supplier_products(current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "supplier":
        raise HTTPException(status_code=403, detail="Only suppliers can access this")
    
    products = await db.products.find({"supplier_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    for product in products:
        category = await db.categories.find_one({"id": product.get("category_id")}, {"_id": 0})
        product["category_name"] = category.get("name") if category else None
        product["supplier_name"] = current_user["full_name"]
        product["supplier_company"] = current_user.get("company_name")
    return products

# ======================= CART ENDPOINTS =======================

@api_router.get("/cart", response_model=CartResponse)
async def get_cart(current_user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not cart:
        cart = {"id": str(uuid.uuid4()), "user_id": current_user["id"], "items": []}
        await db.carts.insert_one(cart)
    
    enriched_items = []
    total = 0.0
    
    for item in cart.get("items", []):
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            supplier = await db.users.find_one({"id": product.get("supplier_id")}, {"_id": 0})
            subtotal = product["price"] * item["quantity"]
            enriched_items.append(CartItemResponse(
                product_id=item["product_id"],
                product_name=product["name"],
                product_image=product["images"][0] if product.get("images") else None,
                supplier_id=product["supplier_id"],
                supplier_name=supplier.get("full_name") if supplier else "Unknown",
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

@api_router.post("/orders", response_model=List[OrderResponse])
async def create_orders(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Group items by supplier
    supplier_items = {}
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            sid = product["supplier_id"]
            if sid not in supplier_items:
                supplier_items[sid] = []
            supplier_items[sid].append({
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": item["quantity"],
                "price": product["price"],
                "unit": product["unit"],
                "subtotal": product["price"] * item["quantity"]
            })
    
    orders = []
    now = datetime.now(timezone.utc).isoformat()
    
    for supplier_id, items in supplier_items.items():
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
            "created_at": now
        }
        
        await db.orders.insert_one(order_doc)
        orders.append(OrderResponse(**order_doc))
    
    # Clear cart
    await db.carts.update_one({"user_id": current_user["id"]}, {"$set": {"items": []}})
    
    return orders

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(current_user: dict = Depends(get_current_user)):
    query = {"$or": [{"buyer_id": current_user["id"]}, {"supplier_id": current_user["id"]}]}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
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
async def create_checkout_session(request: CheckoutRequest, http_request: Request, current_user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    cart = await db.carts.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate total
    total = 0.0
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            total += product["price"] * item["quantity"]
    
    # Convert XAF to USD (approximate rate)
    total_usd = round(total / 600, 2)
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{request.origin_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/checkout/cancel"
    
    checkout_request = CheckoutSessionRequest(
        amount=total_usd,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": current_user["id"], "cart_total_xaf": str(total)}
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Record payment transaction
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": current_user["id"],
        "amount_usd": total_usd,
        "amount_xaf": total,
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}", response_model=PaymentStatusResponse)
async def get_checkout_status(session_id: str, current_user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction record
    if status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "payment_status": "paid"}}
        )
    
    return PaymentStatusResponse(
        status=status.status,
        payment_status=status.payment_status
    )

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"status": "completed", "payment_status": "paid"}}
            )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ======================= REVIEWS ENDPOINTS =======================

@api_router.post("/reviews", response_model=ReviewResponse)
async def create_review(review: ReviewCreate, current_user: dict = Depends(get_current_user)):
    # Verify order exists and belongs to user
    order = await db.orders.find_one({"id": review.order_id, "buyer_id": current_user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    review_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    review_doc = {
        "id": review_id,
        "product_id": review.product_id,
        "order_id": review.order_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "rating": review.rating,
        "comment": review.comment,
        "created_at": now
    }
    
    await db.reviews.insert_one(review_doc)
    
    # Update product rating
    reviews = await db.reviews.find({"product_id": review.product_id}, {"_id": 0}).to_list(1000)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    await db.products.update_one(
        {"id": review.product_id},
        {"$set": {"rating": round(avg_rating, 1), "review_count": len(reviews)}}
    )
    
    return ReviewResponse(**review_doc)

@api_router.get("/products/{product_id}/reviews", response_model=List[ReviewResponse])
async def get_product_reviews(product_id: str):
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
    
    products = []
    for pid in favorites:
        product = await db.products.find_one({"id": pid}, {"_id": 0})
        if product:
            category = await db.categories.find_one({"id": product.get("category_id")}, {"_id": 0})
            supplier = await db.users.find_one({"id": product.get("supplier_id")}, {"_id": 0})
            product["category_name"] = category.get("name") if category else None
            product["supplier_name"] = supplier.get("full_name") if supplier else None
            product["supplier_company"] = supplier.get("company_name") if supplier else None
            products.append(product)
    
    return products

# ======================= MESSAGES ENDPOINTS =======================

@api_router.post("/messages", response_model=MessageResponse)
async def send_message(message: MessageCreate, current_user: dict = Depends(get_current_user)):
    receiver = await db.users.find_one({"id": message.receiver_id}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    msg_doc = {
        "id": msg_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["full_name"],
        "receiver_id": message.receiver_id,
        "receiver_name": receiver["full_name"],
        "content": message.content,
        "product_id": message.product_id,
        "is_read": False,
        "created_at": now
    }
    
    await db.messages.insert_one(msg_doc)
    return MessageResponse(**msg_doc)

@api_router.get("/messages/conversations", response_model=List[ConversationResponse])
async def get_conversations(current_user: dict = Depends(get_current_user)):
    # Get all messages involving current user
    messages = await db.messages.find(
        {"$or": [{"sender_id": current_user["id"]}, {"receiver_id": current_user["id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Group by conversation partner
    conversations = {}
    for msg in messages:
        partner_id = msg["receiver_id"] if msg["sender_id"] == current_user["id"] else msg["sender_id"]
        if partner_id not in conversations:
            partner = await db.users.find_one({"id": partner_id}, {"_id": 0})
            unread = await db.messages.count_documents({
                "sender_id": partner_id,
                "receiver_id": current_user["id"],
                "is_read": False
            })
            conversations[partner_id] = ConversationResponse(
                partner_id=partner_id,
                partner_name=partner.get("full_name") if partner else "Unknown",
                partner_company=partner.get("company_name") if partner else None,
                last_message=msg["content"][:100],
                last_message_time=msg["created_at"],
                unread_count=unread
            )
    
    return list(conversations.values())

@api_router.get("/messages/{partner_id}", response_model=List[MessageResponse])
async def get_messages(partner_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user["id"], "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    # Mark as read
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
    all_ratings = await db.supplier_ratings.find({"supplier_id": supplier_id}, {"_id": 0}).to_list(1000)
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
async def get_supplier_profile(supplier_id: str):
    """Get supplier profile with ratings"""
    supplier = await db.users.find_one({"id": supplier_id, "user_type": "supplier"}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    products_count = await db.products.count_documents({"supplier_id": supplier_id})
    orders_completed = await db.orders.count_documents({"supplier_id": supplier_id, "status": "delivered"})
    
    return SupplierProfileResponse(
        id=supplier["id"],
        full_name=supplier["full_name"],
        company_name=supplier.get("company_name"),
        country=supplier.get("country"),
        city=supplier.get("city"),
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
    """Get list of suppliers"""
    suppliers = await db.users.find({"user_type": "supplier"}, {"_id": 0}).to_list(limit)
    
    result = []
    for supplier in suppliers:
        products_count = await db.products.count_documents({"supplier_id": supplier["id"]})
        orders_completed = await db.orders.count_documents({"supplier_id": supplier["id"], "status": "delivered"})
        
        result.append(SupplierProfileResponse(
            id=supplier["id"],
            full_name=supplier["full_name"],
            company_name=supplier.get("company_name"),
            country=supplier.get("country"),
            city=supplier.get("city"),
            rating=supplier.get("supplier_rating", 0.0),
            rating_count=supplier.get("rating_count", 0),
            communication_avg=supplier.get("communication_avg", 0.0),
            quality_avg=supplier.get("quality_avg", 0.0),
            delivery_avg=supplier.get("delivery_avg", 0.0),
            products_count=products_count,
            orders_completed=orders_completed,
            member_since=supplier["created_at"]
        ))
    
    # Sort by rating
    if sort_by == "rating":
        result.sort(key=lambda x: x.rating, reverse=True)
    
    return result

# ======================= SUPPLIER STATS =======================

@api_router.get("/supplier/stats")
async def get_supplier_stats(current_user: dict = Depends(get_current_user)):
    if current_user["user_type"] != "supplier":
        raise HTTPException(status_code=403, detail="Only suppliers can access this")
    
    products_count = await db.products.count_documents({"supplier_id": current_user["id"]})
    orders = await db.orders.find({"supplier_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    rfqs = await db.rfqs.find({"supplier_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    total_revenue = sum(o.get("total", 0) for o in orders if o.get("payment_status") == "paid")
    pending_orders = sum(1 for o in orders if o.get("status") == "pending")
    completed_orders = sum(1 for o in orders if o.get("status") == "delivered")
    pending_rfqs = sum(1 for r in rfqs if r.get("status") == "pending")
    
    return {
        "products_count": products_count,
        "total_orders": len(orders),
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
        "total_revenue": total_revenue,
        "pending_rfqs": pending_rfqs,
        "total_rfqs": len(rfqs)
    }

# ======================= RFQ (REQUEST FOR QUOTE) ENDPOINTS =======================

@api_router.post("/rfq", response_model=RFQResponse)
async def create_rfq(rfq: RFQCreate, current_user: dict = Depends(get_current_user)):
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
    
    rfq_doc = {
        "id": rfq_id,
        "rfq_number": rfq_number,
        "product_id": rfq.product_id,
        "product_name": product["name"],
        "supplier_id": rfq.supplier_id,
        "supplier_name": supplier["full_name"],
        "buyer_id": current_user["id"],
        "buyer_name": current_user["full_name"],
        "buyer_company": current_user.get("company_name"),
        "quantity": rfq.quantity,
        "target_price": rfq.target_price,
        "quoted_price": None,
        "delivery_location": rfq.delivery_location,
        "delivery_deadline": rfq.delivery_deadline,
        "specifications": rfq.specifications,
        "notes": rfq.notes,
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
async def submit_quote(rfq_id: str, quote: RFQQuote, current_user: dict = Depends(get_current_user)):
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
async def accept_quote(rfq_id: str, current_user: dict = Depends(get_current_user)):
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
async def reject_quote(rfq_id: str, current_user: dict = Depends(get_current_user)):
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
    
    # Create order notification
    await create_notification(
        user_id=current_user["id"],
        type="order",
        title="Paiement confirmé",
        message=f"Votre paiement Mobile Money de {transaction['amount']:,.0f} XAF a été confirmé",
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
        "comment": review.comment,
        "created_at": now
    }
    
    await db.reviews.insert_one(review_doc)
    
    # Update product rating
    reviews = await db.reviews.find({"product_id": review.product_id}, {"_id": 0}).to_list(1000)
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

# ======================= WEBSOCKET FOR CHAT =======================

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
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
                content = data.get("content")
                
                # Save message
                user = await db.users.find_one({"id": user_id}, {"_id": 0})
                receiver = await db.users.find_one({"id": receiver_id}, {"_id": 0})
                
                if receiver:
                    msg_id = str(uuid.uuid4())
                    now = datetime.now(timezone.utc).isoformat()
                    
                    msg_doc = {
                        "id": msg_id,
                        "sender_id": user_id,
                        "sender_name": user.get("full_name"),
                        "receiver_id": receiver_id,
                        "receiver_name": receiver.get("full_name"),
                        "content": content,
                        "is_read": False,
                        "created_at": now
                    }
                    
                    await db.messages.insert_one(msg_doc)
                    
                    # Send to receiver if online
                    await manager.send_personal_message(msg_doc, receiver_id)
                    
                    # Send confirmation to sender
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
    """Seed initial categories and sample data"""
    
    # Check if already seeded
    existing = await db.categories.count_documents({})
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
    
    return {"message": "Data seeded successfully", "categories": len(categories), "products": len(products)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
