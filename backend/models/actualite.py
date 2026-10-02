from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class MediaItem(BaseModel):
    url: str
    type: str
    filename: str
    size: Optional[int] = None


class ActualiteCreate(BaseModel):
    title: str
    content: str
    excerpt: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    is_published: bool = False
    media: Optional[List[MediaItem]] = None


class ActualiteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    is_published: Optional[bool] = None
    media: Optional[List[MediaItem]] = None


class ActualiteOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    content: str
    excerpt: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    author_id: str
    author_name: str
    is_published: bool = False
    published_at: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    slug: Optional[str] = None
    media: Optional[List[MediaItem]] = None
