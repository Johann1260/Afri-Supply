"""
One-shot migration: ensure all existing products have an `is_approved` flag.

Strategy:
- Products with no `is_approved` field are considered legacy (pre-feature) → mark approved
  to keep them visible (they were already live). New products created after this commit
  will explicitly default to `is_approved=False` (require admin review).

Run:
    cd backend && python -m scripts.migrate_is_approved
or:
    python scripts/migrate_is_approved.py

Idempotent: safe to re-run.
"""
import asyncio
import sys
import os

# Allow `python scripts/migrate_is_approved.py` from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db, close_connections


async def run():
    db = get_db()
    res = await db.products.update_many(
        {"is_approved": {"$exists": False}},
        {"$set": {"is_approved": True}},
    )
    print(f"[migrate_is_approved] matched={res.matched_count} modified={res.modified_count}")

    # Verify
    total = await db.products.count_documents({})
    approved = await db.products.count_documents({"is_approved": True})
    pending = await db.products.count_documents({"is_approved": False})
    missing = await db.products.count_documents({"is_approved": {"$exists": False}})
    print(f"[migrate_is_approved] total={total} approved={approved} pending={pending} missing={missing}")

    await close_connections()


if __name__ == "__main__":
    asyncio.run(run())
