from pydantic import BaseModel, ConfigDict
from typing import Optional

class CheckoutRequest(BaseModel):
    origin_url: str
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_country: Optional[str] = None
    notes: Optional[str] = None

class MobileMoneyRequest(BaseModel):
    phone_number: str
    network: str
    country_code: str = "CM"
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_country: Optional[str] = None
    notes: Optional[str] = None

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int

class PaymentTransactionOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str; user_id: str
    amount: Optional[float]=None; amount_xaf: Optional[float]=None
    amount_usd: Optional[float]=None; currency: str = "XAF"
    status: str; payment_type: Optional[str]=None
    phone_number: Optional[str]=None; network: Optional[str]=None
    session_id: Optional[str]=None; created_at: str