from database import get_db
from services.cache_service import cache_get, cache_set

BADGE_CACHE_TTL = 300  # 5min

async def calculate_badges(supplier_id: str) -> list[str]:
    """Calculate badges for a supplier based on criteria."""
    cache_key = f"badges:{supplier_id}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    db = get_db()
    user = await db.users.find_one({"id": supplier_id}, {"_id": 0})
    if not user or user.get("user_type") != "supplier":
        return []

    badges = []

    # 1. Verified Supplier — admin-approved + email verified
    if user.get("account_status") == "active" and user.get("email_verified"):
        badges.append("verified")

    # 2. Documents verified
    if user.get("company_documents") and len(user.get("company_documents", [])) >= 2:
        badges.append("docs_verified")

    # 3. Gold Supplier — 20+ orders completed + 4.0+ rating
    orders_completed = await db.orders.count_documents({
        "supplier_id": supplier_id, "status": "delivered", "payment_status": "paid"
    })
    if orders_completed >= 50:
        badges.append("platinum")
    elif orders_completed >= 20:
        badges.append("gold")
    elif orders_completed >= 5:
        badges.append("silver")

    # 4. Top Rated — avg rating >= 4.5 with 10+ reviews
    pipeline = [
        {"$match": {"supplier_id": supplier_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    result = await db.reviews.aggregate(pipeline).to_list(1)
    if result and result[0]["count"] >= 10 and result[0]["avg"] >= 4.5:
        badges.append("top_rated")

    # 5. Quick Responder — avg RFQ response < 24h
    rfq_pipeline = [
        {"$match": {"supplier_id": supplier_id, "status": {"$in": ["quoted", "accepted"]}}},
        {"$count": "total"}
    ]
    rfq_result = await db.rfqs.aggregate(rfq_pipeline).to_list(1)
    if rfq_result and rfq_result[0]["total"] >= 10:
        badges.append("quick_responder")

    # 6. Trade Assurance
    ta_count = await db.trade_assurance.count_documents({
        "supplier_id": supplier_id, "status": "released"
    })
    if ta_count >= 3:
        badges.append("trade_assurance")

    # 7. Identity Verified — NUI + RC renseignés
    if user.get("nui") and user.get("rc_number"):
        badges.append("identity_verified")

    # 8. Certified — badge attribué manuellement par un admin
    if "certified" in (user.get("admin_badges") or []):
        badges.append("certified")

    await cache_set(cache_key, badges, BADGE_CACHE_TTL)
    return badges

BADGE_META = {
    "verified":          {"label": "Fournisseur Vérifié",    "label_en": "Verified Supplier",    "icon": "✓",  "color": "#0ea5e9"},
    "docs_verified":     {"label": "Documents Vérifiés",     "label_en": "Docs Verified",         "icon": "📄", "color": "#6366f1"},
    "identity_verified": {"label": "Identité Vérifiée",      "label_en": "Identity Verified",     "icon": "🪪", "color": "#0d9488"},
    "certified":         {"label": "Certifié AfriSupply",    "label_en": "AfriSupply Certified",  "icon": "🏅", "color": "#dc2626"},
    "gold":              {"label": "Gold Supplier",           "label_en": "Gold Supplier",          "icon": "🥇", "color": "#f59e0b"},
    "silver":            {"label": "Silver Supplier",         "label_en": "Silver Supplier",        "icon": "🥈", "color": "#94a3b8"},
    "platinum":          {"label": "Platinum Supplier",       "label_en": "Platinum Supplier",      "icon": "💎", "color": "#8b5cf6"},
    "top_rated":         {"label": "Top Évalué",              "label_en": "Top Rated",              "icon": "⭐", "color": "#f97316"},
    "quick_responder":   {"label": "Réponse Rapide",          "label_en": "Quick Responder",        "icon": "⚡", "color": "#10b981"},
    "trade_assurance":   {"label": "Trade Assurance",         "label_en": "Trade Assurance",        "icon": "🛡️", "color": "#034168"},
}

# Badges pouvant être attribués manuellement par un admin
ADMIN_ASSIGNABLE_BADGES = ["certified", "docs_verified", "identity_verified"]