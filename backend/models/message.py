from pydantic import BaseModel, ConfigDict
from typing import Optional

class MessageCreate(BaseModel):
    receiver_id: str
    content: str
    product_id: Optional[str]=None

class MessageOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    sender_id: str; sender_name: str
    receiver_id: str; receiver_name: str
    content: str
    product_id: Optional[str]=None
    is_read: bool
    is_system: Optional[bool]=False
    created_at: str

class ConversationOut(BaseModel):
    partner_id: str; partner_name: str
    partner_company: Optional[str]=None
    last_message: str; last_message_time: str
    unread_count: int