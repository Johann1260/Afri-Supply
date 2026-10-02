# 🏗️ AfriSupply — Backend API

> API REST haute performance pour la marketplace B2B industrielle d'Afrique Centrale.

---

## ⚡ Démarrage en 3 étapes

```bash
# 1. Configurer l'environnement
cp .env.example .env
# → Remplir au minimum : MONGO_URL et JWT_SECRET

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Lancer le serveur
make dev
# → API disponible sur http://localhost:8000
# → Documentation Swagger sur http://localhost:8000/docs
```

---

## 📁 Architecture du projet

Le backend suit une architecture **modulaire par couche** : chaque endpoint a son router, chaque logique métier a son service, chaque structure de données a son modèle Pydantic.

```
backend/
│
├── main.py                  # 🚀 Point d'entrée FastAPI
│                            #    - Monte tous les routers
│                            #    - Configure middleware (CORS, GZip, Security Headers)
│                            #    - Crée 30+ index MongoDB au démarrage
│                            #    - Initialise Redis (graceful si indisponible)
│
├── config.py                # ⚙️ Configuration centralisée
│                            #    - Lit .env via pydantic-settings
│                            #    - Expose settings.is_prod, settings.cors_origins, etc.
│                            #    - Valide que les variables critiques existent
│
├── database.py              # 🗄️ Connexions base de données
│                            #    - MongoDB via Motor (async) avec pool 5-50 connexions
│                            #    - Redis via aioredis (optionnel, graceful degradation)
│                            #    - Fonctions : get_db(), get_redis(), close_connections()
│
├── dependencies.py          # 🔐 Dépendances d'injection FastAPI
│                            #    - get_current_user        → JWT obligatoire
│                            #    - get_current_user_optional → JWT optionnel (pages publiques)
│                            #    - require_admin            → user_type == "admin"
│                            #    - require_supplier         → user_type == "supplier"
│                            #    - require_active_supplier  → supplier + account_status == "active"
│
├── seed.py                  # 🌱 Données de test
│                            #    - 8 catégories industrielles CEMAC
│                            #    - 1 admin + 1 fournisseur + 1 acheteur
│                            #    - 5 produits exemple (ciment, acier, câble, casque, tôle)
│
├── models/                  # 📦 Modèles Pydantic v2 (validation entrée/sortie)
│   ├── user.py              #    UserCreate, UserLogin, UserUpdate, PasswordChange, UserOut, TokenOut
│   ├── product.py           #    ProductCreate, ProductUpdate, ProductOut, CategoryOut
│   ├── order.py             #    OrderCreate, OrderOut, DeliveryFeeUpdate, OrderTrackingEvent
│   ├── rfq.py               #    RFQCreate, RFQQuote, RFQOut
│   ├── message.py           #    MessageCreate, MessageOut, ConversationOut
│   ├── payment.py           #    CheckoutRequest, MobileMoneyRequest, CartItemAdd
│   ├── otp.py               #    OTPSend, OTPVerify, EmailChangeRequest
│   ├── trade_assurance.py   #    TradeAssuranceCreate, DisputeCreate, TradeAssuranceOut
│   ├── storefront.py        #    StorefrontUpdate, StorefrontOut
│   └── common.py            #    ReviewCreate, BlogPostCreate, CategoryCreate, etc.
│
├── routers/                 # 🛣️ Endpoints API (117 routes au total)
│   ├── auth.py              #    POST /register, /login, /refresh, GET/PUT /me, /password
│   │                        #    + Email change sécurisé (OTP → 24h delay → activation)
│   │                        #    + Upload documents fournisseur
│   ├── products.py          #    CRUD produits + recherche + PDF fiche produit + reviews
│   ├── orders.py            #    Workflow 10 statuts + tracking timeline + delivery_fee
│   │                        #    + Facture PDF auto + transitions validées
│   ├── cart.py              #    GET/POST/PUT/DELETE panier enrichi
│   ├── payments.py          #    Stripe checkout + Mobile Money (MTN/Orange/Airtel)
│   │                        #    + Trade Assurance (escrow/confirm/dispute)
│   │                        #    + Webhook Stripe avec signature vérifiée
│   ├── rfq.py               #    Demandes de devis : create/quote/accept/reject + notifications
│   ├── messages.py          #    Messagerie 100% anonymisée + anti-bypass inline
│   ├── websocket.py         #    Chat temps réel + rate limit Redis (30 msg/min)
│   ├── notifications.py     #    CRUD + unread count + mark read
│   ├── suppliers.py         #    Profils publics + badges + storefront + stats self-service
│   │                        #    + Contact unlock (jamais d'info perso exposée)
│   ├── admin.py             #    Users, orders, products, catégories
│   │                        #    + Trade Assurance + résolution litiges
│   ├── blog.py              #    Articles CRUD (admin only)
│   ├── categories.py        #    Liste catégories (Redis cached 1h)
│   ├── favorites.py         #    Add/remove favoris
│   ├── reviews.py           #    Avis produit + pending reviews
│   └── otp.py               #    OTP multi-canal : email + SMS + WhatsApp
│
├── services/                # 🧠 Logique métier réutilisable
│   ├── auth_service.py      #    JWT (access + refresh), bcrypt hash/verify
│   ├── cache_service.py     #    Redis helpers : get/set/del/pattern avec TTL configurable
│   ├── bypass_service.py    #    Regex anti-contact CEMAC (+237, WhatsApp, etc.)
│   │                        #    + generate_anonymous_id() pour masquer les identités
│   ├── email_service.py     #    Resend : envoi email + templates HTML (verify, reset, approved...)
│   ├── pdf_service.py       #    ReportLab : fiche produit PDF async (run_in_executor)
│   ├── otp_service.py       #    OTP 6 digits, Redis-first + MongoDB fallback
│   │                        #    + Twilio SMS/WhatsApp, 5 tentatives max, TTL 10min
│   └── badge_service.py     #    8 badges dynamiques calculés sur critères DB
│                            #    (verified, gold, silver, platinum, top_rated, etc.)
│
├── middleware/
│   └── security.py          # 🛡️ Security headers (CSP, X-Frame-Options, X-XSS, Referrer-Policy)
│
├── tests/                   # 🧪 65 tests (pytest-asyncio + httpx)
│   ├── conftest.py          #    Fixtures : client, users, products, auth headers
│   ├── test_auth.py         #    Register, login, me, password change
│   ├── test_products.py     #    CRUD, search, PDF sheet, reviews
│   ├── test_orders_cart_messages.py  # Cart, orders, messages, anti-bypass
│   ├── test_admin_suppliers_rfq.py  # Admin, suppliers, RFQ, notifications, favorites
│   └── test_security.py     #    Bypass detection, XSS sanitization, auth edge cases
│
├── Dockerfile               # 🐳 Image Python 3.12-slim + gunicorn 4 workers
├── docker-compose.yml       # 🐳 API + MongoDB 7 + Redis 7 (healthcheck inclus)
├── Makefile                 # 📋 make dev / prod / test / seed / docker-compose
├── requirements.txt         # 📋 16 dépendances (FastAPI, Motor, Redis, Stripe, Twilio...)
└── .env.example             # 📋 Template variables d'environnement
```

---

## 🔑 Variables d'environnement

| Variable | Requis | Exemple | Description |
|----------|--------|---------|-------------|
| `MONGO_URL` | ✅ **Oui** | `mongodb+srv://user:pass@cluster.mongodb.net` | URI MongoDB (local ou Atlas) |
| `JWT_SECRET` | ✅ **Oui** | `a1b2c3...` (64+ chars) | Clé secrète JWT — ne jamais exposer |
| `ENVIRONMENT` | ❌ | `development` ou `production` | En prod : désactive /docs, /seed, localhost CORS |
| `FRONTEND_URL` | ❌ | `https://afrisupply.com` | URL du frontend (liens email, CORS) |
| `STRIPE_API_KEY` | ⚠️ Recommandé | `sk_live_...` | Paiements carte bancaire |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ Recommandé | `whsec_...` | Vérification signature webhook |
| `RESEND_API_KEY` | ⚠️ Recommandé | `re_...` | Emails transactionnels |
| `REDIS_URL` | ❌ Optionnel | `redis://localhost:6379` | Cache + rate limit WS (fonctionne sans) |
| `TWILIO_ACCOUNT_SID` | ❌ Optionnel | `AC...` | OTP par SMS |
| `TWILIO_AUTH_TOKEN` | ❌ Optionnel | `...` | OTP par SMS |
| `TWILIO_PHONE_NUMBER` | ❌ Optionnel | `+1234567890` | Numéro SMS Twilio |
| `TWILIO_WHATSAPP_NUMBER` | ❌ Optionnel | `+1234567890` | Numéro WhatsApp Twilio |

> 💡 **Minimum pour démarrer** : `MONGO_URL` + `JWT_SECRET`. Tout le reste est optionnel avec graceful degradation.

---

## 📋 Commandes disponibles

```bash
make install          # Installer toutes les dépendances Python
make dev              # Lancer en mode développement (hot reload)
make prod             # Lancer en production (gunicorn, 4 workers)
make test             # Exécuter les 65 tests
make test-cov         # Tests + rapport de couverture
make seed             # Peupler la base avec des données de test
make lint             # Vérifier la syntaxe de tous les fichiers Python
make docker-build     # Construire l'image Docker
make docker-compose   # Lancer API + MongoDB + Redis via Docker
```

---

## 🔒 Règles de sécurité

Ces règles sont appliquées **partout** dans le code :

1. **Anonymisation stricte** — Les vrais noms, téléphones, emails ne sont **jamais** exposés dans les réponses API. On utilise `generate_anonymous_id()` (hash SHA256 → "Partenaire-A1B2C3").

2. **Fournisseur non approuvé = inactif** — Un supplier avec `account_status != "active"` ne peut pas vendre, publier de produits, ni accéder au dashboard fournisseur.

3. **Anti-bypass** — Les messages contenant des coordonnées (téléphone, email, WhatsApp, URL) sont **bloqués** automatiquement. L'avertissement apparaît **dans la conversation existante** (pas de nouveau chat système).

4. **Trade Assurance** — Les fonds sont bloqués en escrow jusqu'à confirmation de réception par l'acheteur. En cas de litige, un admin arbitre.

5. **Commandes post-paiement uniquement** — Les commandes sont créées dans le webhook Stripe ou après confirmation Mobile Money. Jamais avant le paiement.

---

## 🚀 Déploiement

**Render / Railway / Fly.io :**
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Docker :**
```bash
docker-compose up -d
curl http://localhost:8000/api/health
# → {"status": "ok", "version": "2.0.0"}
```

**Checklist production :**
- [ ] `ENVIRONMENT=production`
- [ ] `JWT_SECRET` unique (64+ chars, généré avec `openssl rand -hex 32`)
- [ ] `MONGO_URL` pointe vers MongoDB Atlas
- [ ] `STRIPE_WEBHOOK_SECRET` configuré
- [ ] `ALLOWED_ORIGINS` = domaines frontend uniquement
- [ ] `REDIS_URL` configuré (Upstash recommandé)

---

## 🤝 Contribuer

1. **Architecture** : `routers/` → `services/` → `models/`. Chaque couche a sa responsabilité.
2. **Validation** : Toujours des modèles Pydantic (jamais `data: dict` pour les nouvelles routes).
3. **Sécurité** : Anonymiser toute donnée personnelle dans les réponses.
4. **Tests** : Ajouter un test pour chaque nouvel endpoint.
5. **i18n** : Ajouter les clés FR + EN dans `frontend/LocaleContext.jsx`.

---

*AfriSupply © 2024-2025 — Marketplace B2B Industrielle Zone CEMAC*