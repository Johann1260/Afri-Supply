from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum


class AdminRole(str, Enum):
    SUPERADMIN = "superadmin"
    MODERATOR  = "moderator"
    SUPPORT    = "support"
    FINANCE    = "finance"


# Permissions par rôle — évolutif
ROLE_PERMISSIONS: dict[str, dict] = {
    "superadmin": {"all": True},
    "moderator":  {"approve_supplier": True, "manage_products": True, "manage_actualites": True, "view_users": True},
    "support":    {"view_users": True, "view_orders": True, "view_rfq": True},
    "finance":    {"view_orders": True, "manage_escrow": True, "manage_momo": True},
}


def has_permission(admin: dict, perm: str) -> bool:
    role = admin.get("admin_role", "superadmin")
    perms = ROLE_PERMISSIONS.get(role, {})
    return bool(perms.get("all") or perms.get(perm))


class AdminLogOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    admin_id: str
    admin_name: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    detail: str
    created_at: str


class AdminCreate(BaseModel):
    full_name: str
    email: str
    password: str
    admin_role: AdminRole = AdminRole.SUPERADMIN


class AdminUpdate(BaseModel):
    full_name: Optional[str] = None
    admin_role: Optional[AdminRole] = None
    is_active: Optional[bool] = None
