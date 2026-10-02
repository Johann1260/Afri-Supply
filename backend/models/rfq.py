from pydantic import BaseModel, ConfigDict
from typing import Optional, List

# ── RFQ ─────────────────────────────────────────────────────────────────────

class RFQCreate(BaseModel):
    """RFQ privé — lié à un produit catalogue existant."""
    product_id: str
    quantity: int
    delivery_location: str
    target_price: Optional[float] = None
    delivery_deadline: Optional[str] = None
    specifications: Optional[str] = None
    notes: Optional[str] = None

class PublicRFQCreate(BaseModel):
    """RFQ public — besoin libre, tous les fournisseurs approuvés peuvent répondre."""
    title: str
    description: str
    category_id: Optional[str] = None
    quantity: int
    unit: str = "unité"
    delivery_location: str
    target_price: Optional[float] = None
    delivery_deadline: Optional[str] = None
    specifications: Optional[str] = None
    attachments: Optional[List[str]] = None

class RFQOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    rfq_number: str
    rfq_type: str = "private"
    title: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    buyer_id: str
    buyer_name: str
    buyer_company: Optional[str] = None
    quantity: int
    unit: str = "unité"
    target_price: Optional[float] = None
    delivery_location: str
    delivery_deadline: Optional[str] = None
    specifications: Optional[str] = None
    notes: Optional[str] = None
    description: Optional[str] = None
    attachments: Optional[List[str]] = None
    # Statuts: open → comparing → accepted → ordered → closed | cancelled
    status: str
    quote_count: int = 0
    best_price: Optional[float] = None
    accepted_quotation_id: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

# ── Quotation (devis) ────────────────────────────────────────────────────────

class QuotationCreate(BaseModel):
    unit_price: float
    quantity: int
    currency: str = "XAF"
    delivery_time_days: int
    validity_days: int = 30
    moq: Optional[int] = None
    conditions: Optional[str] = None
    notes: Optional[str] = None

class QuotationOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    rfq_id: str
    supplier_id: str
    supplier_name: str
    unit_price: float
    total_price: float
    quantity: int
    currency: str = "XAF"
    delivery_time_days: int
    validity_days: int
    moq: Optional[int] = None
    conditions: Optional[str] = None
    notes: Optional[str] = None
    status: str = "pending"
    created_at: str
    updated_at: Optional[str] = None

# ── Legacy compat ────────────────────────────────────────────────────────────
class RFQQuote(BaseModel):
    quoted_price: float
    delivery_time: Optional[str] = None
    response_notes: Optional[str] = None
