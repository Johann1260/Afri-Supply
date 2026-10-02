from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List

class ProductCreate(BaseModel):
    name: str; description: str = ""
    name_en: Optional[str]=None; description_en: Optional[str]=None
    price: float; unit: str = "unité"
    min_order_quantity: int = 1; stock_quantity: int = 0
    category_id: str; specifications: Optional[Dict[str,Any]]=None
    is_available: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str]=None; description: Optional[str]=None
    name_en: Optional[str]=None; description_en: Optional[str]=None
    price: Optional[float]=None; unit: Optional[str]=None
    min_order_quantity: Optional[int]=None; stock_quantity: Optional[int]=None
    category_id: Optional[str]=None; specifications: Optional[Dict[str,Any]]=None
    is_available: Optional[bool]=None

class ProductOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str; name: str; description: str = ""
    name_en: Optional[str]=None; description_en: Optional[str]=None
    category_id: str; category_name: Optional[str]=None
    supplier_id: str; supplier_name: Optional[str]=None
    supplier_company: Optional[str]=None
    price: float; unit: str; min_order_quantity: int; stock_quantity: int
    specifications: Optional[Dict[str,Any]]=None
    images: List[str] = []
    is_available: bool; rating: float = 0.0; review_count: int = 0
    created_at: str

class CategoryOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str; name: str; name_en: Optional[str]=None
    icon: Optional[str]=None; description: Optional[str]=None