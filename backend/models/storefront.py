from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any

class StorefrontUpdate(BaseModel):
    slug: Optional[str] = None
    headline: Optional[str] = None
    headline_en: Optional[str] = None
    about: Optional[str] = None
    about_en: Optional[str] = None
    banner_image: Optional[str] = None
    logo: Optional[str] = None
    specialties: Optional[List[str]] = None
    certifications: Optional[List[str]] = None
    year_established: Optional[int] = None
    employee_count: Optional[str] = None
    annual_revenue: Optional[str] = None
    export_countries: Optional[List[str]] = None
    social_links: Optional[Dict[str, str]] = None

class StorefrontOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    supplier_id: str; slug: str
    company_name: Optional[str] = None
    headline: Optional[str] = None; about: Optional[str] = None
    banner_image: Optional[str] = None; logo: Optional[str] = None
    specialties: List[str] = []; certifications: List[str] = []
    year_established: Optional[int] = None
    employee_count: Optional[str] = None
    annual_revenue: Optional[str] = None
    export_countries: List[str] = []
    social_links: Dict[str, str] = {}
    badges: List[str] = []
    product_count: int = 0; avg_rating: float = 0.0; review_count: int = 0
    country: Optional[str] = None; city: Optional[str] = None