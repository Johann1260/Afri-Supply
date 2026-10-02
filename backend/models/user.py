from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, Literal
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=200)
    company_name: Optional[str]=None; phone: Optional[str]=None
    country: Optional[str]=None; city: Optional[str]=None
    user_type: Literal["buyer", "supplier"] = "buyer"

class UserLogin(BaseModel):
    email: EmailStr; password: str

class UserUpdate(BaseModel):
    full_name: Optional[str]=None; company_name: Optional[str]=None
    phone: Optional[str]=None; city: Optional[str]=None; country: Optional[str]=None

class PasswordChange(BaseModel):
    current_password: str; new_password: str

class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str; email: str; full_name: str
    company_name: Optional[str]=None; phone: Optional[str]=None
    country: Optional[str]=None; city: Optional[str]=None
    user_type: str; account_status: Optional[str]="active"
    email_verified: Optional[bool]=True; created_at: str

class TokenOut(BaseModel):
    access_token: str; refresh_token: Optional[str]=None
    token_type: str = "bearer"; user: UserOut