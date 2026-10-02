from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any

class OrderItem(BaseModel):
    product_id: str; product_name: str
    quantity: int; price: float; unit: str; subtotal: float

class OrderCreate(BaseModel):
    payment_method: str = "stripe"
    notes: Optional[str]=None
    shipping_address: Optional[str]=None
    shipping_city: Optional[str]=None
    shipping_country: Optional[str]=None

class OrderOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str; order_number: str
    buyer_id: str; buyer_name: str
    supplier_id: str; supplier_name: str
    items: List[Dict[str,Any]]
    subtotal: float; delivery_fee: float = 0.0; total: float
    status: str; payment_status: str
    payment_method: Optional[str]=None
    notes: Optional[str]=None
    shipping_address: Optional[str]=None
    shipping_city: Optional[str]=None
    shipping_country: Optional[str]=None
    trade_assurance: Optional[bool]=False
    ta_status: Optional[str]=None
    created_at: str

class DeliveryFeeUpdate(BaseModel):
    delivery_fee: float

class OrderTrackingEvent(BaseModel):
    status: str; description: str
    location: Optional[str]=None