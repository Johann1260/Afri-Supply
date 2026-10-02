from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any

class BaseResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

# ── Input models for loose dict endpoints ────────────────────────────────────
class ReviewCreate(BaseModel):
    product_id: str; order_id: str; rating: float; comment: str = ""

class BlogPostCreate(BaseModel):
    title: str; title_en: Optional[str]=None
    content: str; content_en: Optional[str]=None
    excerpt: Optional[str]=None; cover_image: Optional[str]=None
    tags: List[str] = []; is_published: bool = False

class BlogPostUpdate(BaseModel):
    title: Optional[str]=None; title_en: Optional[str]=None
    content: Optional[str]=None; content_en: Optional[str]=None
    excerpt: Optional[str]=None; cover_image: Optional[str]=None
    tags: Optional[List[str]]=None; is_published: Optional[bool]=None

class CategoryCreate(BaseModel):
    name: str; name_en: Optional[str]=None
    icon: Optional[str]=None; description: Optional[str]=None

class SupplierRating(BaseModel):
    rating: float; comment: str = ""

class TrackingEvent(BaseModel):
    status: str; description: str; location: Optional[str]=None

class EmailRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str; password: str

# NOTE: UserResponse, TokenResponse, ProductResponse, OrderResponse, MessageResponse,
# NotificationResponse, RFQResponse ont été supprimées — utilisez les modèles
# canoniques dans leurs fichiers respectifs (user.py, product.py, order.py, etc.)