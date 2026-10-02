from database import get_db
from services.auth_service import hash_password
from datetime import datetime, timezone
import uuid, hashlib

async def run_seed():
    db = get_db()

    # Auto-migration: les produits seedés AVANT l'ajout du flag is_approved
    # restent visibles publiquement (rétrocompat).
    migrated = await db.products.update_many(
        {"is_approved": {"$exists": False}},
        {"$set": {"is_approved": True}}
    )
    if migrated.modified_count:
        print(f"[seed] Migration is_approved: {migrated.modified_count} produit(s) mis à jour")

    # Vérifier si la base est déjà seedée
    existing_products = await db.products.count_documents({})
    if existing_products > 30:
        return {"message": "Database already seeded", "products": existing_products, "migrated": migrated.modified_count}

    now = datetime.now(timezone.utc).isoformat()

    # ====================== CATEGORIES ======================
    categories = [
        {
            "id": str(uuid.uuid4()),
            "name": "Construction Métallique",
            "name_en": "Metal Construction",
            "description": "Structures métalliques, charpentes, portails et équipements en acier",
            "description_en": "Metal structures, frameworks, gates and steel equipment",
            "icon": "Wrench",
            "image_url": "https://images.pexels.com/photos/6509862/pexels-photo-6509862.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Construction BTP",
            "name_en": "Building & Construction",
            "description": "Matériaux de construction, ciment, équipements de chantier",
            "description_en": "Construction materials, cement, site equipment",
            "icon": "HardHat",
            "image_url": "https://images.pexels.com/photos/3862384/pexels-photo-3862384.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Maintenance Industrielle",
            "name_en": "Industrial Maintenance",
            "description": "Pièces détachées, outillage, équipements de maintenance",
            "description_en": "Spare parts, tools, maintenance equipment",
            "icon": "Gear",
            "image_url": "https://images.unsplash.com/photo-1576666735112-87a8ea71671c?crop=entropy&cs=srgb&fm=jpg&q=85"
        }
    ]

    for cat in categories:
        await db.categories.update_one(
            {"name": cat["name"]},
            {"$setOnInsert": cat},
            upsert=True
        )

    # ====================== UTILISATEURS ======================
    # Admin
    await db.users.update_one({"email": "admin@afrisupply.com"}, {
        "$setOnInsert": {
            "id": str(uuid.uuid4()),
            "email": "admin@afrisupply.com",
            "full_name": "Admin AfriSupply",
            "user_type": "admin",
            "anonymous_id": "Partenaire-ADMIN00",
            "phone": "+237 690 000 001",
            "password_hash": hash_password("Admin@AfriSupply2025!"),
            "account_status": "active",
            "email_verified": True,
            "created_at": now
        }
    }, upsert=True)

    # Supplier — toujours lire l'id réel depuis la DB après upsert
    _sup_seed_id = str(uuid.uuid4())
    await db.users.update_one({"email": "supplier@afrisupply.com"}, {
        "$setOnInsert": {
            "id": _sup_seed_id,
            "anonymous_id": f"Partenaire-{hashlib.sha256(_sup_seed_id.encode()).hexdigest()[:6].upper()}",
            "email": "supplier@afrisupply.com",
            "full_name": "Jean-Pierre Mbongo",
            "company_name": "Acier Plus SARL",
            "phone": "+237 690 000 000",
            "country": "Cameroun",
            "city": "Douala",
            "user_type": "supplier",
            "password_hash": hash_password("supplier123"),
            "account_status": "active",
            "email_verified": True,
            "created_at": now
        }
    }, upsert=True)
    # CRITICAL: use the id actually stored in DB (not the freshly generated one)
    _sup_doc = await db.users.find_one({"email": "supplier@afrisupply.com"}, {"id": 1, "anonymous_id": 1})
    supplier_id = _sup_doc["id"]
    # Ensure anonymous_id is stored from real id (not from _sup_seed_id which may differ)
    if not _sup_doc.get("anonymous_id"):
        _real_anon = f"Partenaire-{hashlib.sha256(supplier_id.encode()).hexdigest()[:6].upper()}"
        await db.users.update_one({"id": supplier_id}, {"$set": {"anonymous_id": _real_anon}})

    # Buyer
    _buy_seed_id = str(uuid.uuid4())
    await db.users.update_one({"email": "buyer@afrisupply.com"}, {
        "$setOnInsert": {
            "id": _buy_seed_id,
            "anonymous_id": f"Partenaire-{hashlib.sha256(_buy_seed_id.encode()).hexdigest()[:6].upper()}",
            "email": "buyer@afrisupply.com",
            "full_name": "Marie Ndong",
            "company_name": "Constructions Gabon SA",
            "phone": "+241 66 000 000",
            "country": "Gabon",
            "city": "Libreville",
            "user_type": "buyer",
            "password_hash": hash_password("buyer123"),
            "account_status": "active",
            "email_verified": True,
            "created_at": now
        }
    }, upsert=True)
    _buy_doc = await db.users.find_one({"email": "buyer@afrisupply.com"}, {"id": 1, "anonymous_id": 1})
    buyer_id = _buy_doc["id"]
    if not _buy_doc.get("anonymous_id"):
        _real_anon_b = f"Partenaire-{hashlib.sha256(buyer_id.encode()).hexdigest()[:6].upper()}"
        await db.users.update_one({"id": buyer_id}, {"$set": {"anonymous_id": _real_anon_b}})

    # ====================== PRODUITS ======================
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Poutrelles IPE 200",
            "name_en": "IPE 200 Steel Beams",
            "description": "Poutrelles en acier IPE 200, longueur 12m, qualité S235JR. Idéal pour structures de bâtiments industriels.",
            "description_en": "IPE 200 steel beams, 12m length, S235JR quality. Ideal for industrial building structures.",
            "category_id": categories[0]["id"],
            "supplier_id": supplier_id,
            "price": 125000.0,
            "min_order_quantity": 10,
            "unit": "pièce",
            "stock_quantity": 500,
            "specifications": {"longueur": "12m", "qualite": "S235JR", "poids": "26.2 kg/m"},
            "images": ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800"],
            "is_available": True,
            "is_approved": True,
            "rating": 4.5,
            "review_count": 12,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ciment Portland CEM I 42.5",
            "name_en": "Portland Cement CEM I 42.5",
            "description": "Ciment Portland haute résistance, sac de 50kg. Conforme aux normes CEMAC.",
            "description_en": "High resistance Portland cement, 50kg bag. Compliant with CEMAC standards.",
            "category_id": categories[1]["id"],
            "supplier_id": supplier_id,
            "price": 5500.0,
            "min_order_quantity": 100,
            "unit": "sac",
            "stock_quantity": 10000,
            "specifications": {"poids": "50kg", "classe": "42.5N", "norme": "EN 197-1"},
            "images": ["https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800"],
            "is_available": True,
            "is_approved": True,
            "rating": 4.8,
            "review_count": 45,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Groupe Électrogène 100 KVA",
            "name_en": "100 KVA Generator Set",
            "description": "Groupe électrogène diesel 100 KVA, démarrage automatique, insonorisé.",
            "description_en": "100 KVA diesel generator set, automatic start, soundproof.",
            "category_id": categories[2]["id"],
            "supplier_id": supplier_id,
            "price": 8500000.0,
            "min_order_quantity": 1,
            "unit": "unité",
            "stock_quantity": 15,
            "specifications": {"puissance": "100 KVA", "carburant": "Diesel", "autonomie": "8h"},
            "images": ["https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800"],
            "is_available": True,
            "is_approved": True,
            "rating": 4.9,
            "review_count": 8,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Tôles Ondulées Galvanisées",
            "name_en": "Galvanized Corrugated Sheets",
            "description": "Tôles ondulées galvanisées, épaisseur 0.5mm, longueur 3m. Protection anticorrosion.",
            "description_en": "Galvanized corrugated sheets, 0.5mm thickness, 3m length. Anti-corrosion protection.",
            "category_id": categories[0]["id"],
            "supplier_id": supplier_id,
            "price": 15000.0,
            "min_order_quantity": 50,
            "unit": "feuille",
            "stock_quantity": 2000,
            "specifications": {"epaisseur": "0.5mm", "longueur": "3m", "largeur": "0.9m"},
            "images": ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"],
            "is_available": True,
            "is_approved": True,
            "rating": 4.3,
            "review_count": 23,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Bétonnière 350L",
            "name_en": "350L Concrete Mixer",
            "description": "Bétonnière professionnelle 350 litres, moteur diesel, châssis renforcé.",
            "description_en": "Professional 350 liter concrete mixer, diesel engine, reinforced chassis.",
            "category_id": categories[1]["id"],
            "supplier_id": supplier_id,
            "price": 1200000.0,
            "min_order_quantity": 1,
            "unit": "unité",
            "stock_quantity": 25,
            "specifications": {"capacite": "350L", "moteur": "Diesel 10HP", "poids": "280kg"},
            "images": ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800"],
            "is_available": True,
            "is_approved": True,
            "rating": 4.6,
            "review_count": 15,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Compresseur d'Air 500L",
            "name_en": "500L Air Compressor",
            "description": "Compresseur d'air industriel 500 litres, 10 bars, triphasé.",
            "description_en": "Industrial air compressor 500 liters, 10 bars, three-phase.",
            "category_id": categories[2]["id"],
            "supplier_id": supplier_id,
            "price": 2800000.0,
            "min_order_quantity": 1,
            "unit": "unité",
            "stock_quantity": 10,
            "specifications": {"capacite": "500L", "pression": "10 bars", "debit": "800 L/min"},
            "images": ["https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800"],
            "is_available": True,
            "is_approved": True,
            "rating": 4.7,
            "review_count": 6,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]

    # Upsert par nom pour éviter les doublons sur re-seed
    for p in products:
        await db.products.update_one(
            {"name": p["name"], "supplier_id": p["supplier_id"]},
            {"$setOnInsert": p},
            upsert=True
        )

    print(f"✅ Seed terminé : {len(categories)} catégories, {len(products)} produits, 3 utilisateurs créés.")

    return {
        "message": "Database seeded successfully",
        "categories": len(categories),
        "products": len(products),
        "users": 3
    }