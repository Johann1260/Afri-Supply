from pydantic import BaseModel, ConfigDict
from typing import Optional

class TradeAssuranceCreate(BaseModel):
    order_id: str

class TradeAssuranceOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str; order_id: str; buyer_id: str; supplier_id: str
    amount: float; currency: str = "XAF"
    status: str  # held, released, disputed, refunded
    hold_until: Optional[str] = None
    buyer_confirmed: bool = False
    created_at: str; released_at: Optional[str] = None

class DisputeCreate(BaseModel):
    reason: str; description: str