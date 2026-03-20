# AfriSupply - Product Requirements Document

## Original Problem Statement
Marketplace B2B industrielle pour l'Afrique centrale (zone CEMAC) connectant fournisseurs industriels et entreprises acheteuses dans les domaines:
1. Construction métallique
2. Construction BTP  
3. Maintenance industrielle

## Architecture

### Tech Stack
- **Frontend**: React 19 + TailwindCSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT tokens
- **Payments**: Stripe + Mobile Money (MOCKED)
- **AI**: OpenAI GPT-5.2 for product recommendations (Emergent LLM Key)
- **Notifications**: Email (MOCKED - logged to console)

### Design System
- Primary Color: #034168 (Industrial Blue)
- Accent Color: #FF6A00 (Action Orange)
- Typography: Chivo (headings), Manrope (body), IBM Plex Mono (codes)
- Icons: Phosphor Icons
- Logo: Custom AfriSupply logo

## User Personas

### 1. Supplier (Fournisseur)
- Industrial suppliers in CEMAC region
- Manage products, orders, statistics, RFQ responses
- Dashboard with revenue analytics and pending RFQs

### 2. Buyer (Acheteur)
- B2B companies buying industrial supplies
- Browse products, place orders, submit RFQs
- Track orders, manage favorites, real-time messaging

## Core Requirements (Static)

### Functional Requirements
- [x] User registration/authentication (buyer/supplier)
- [x] Product catalog with search and filters
- [x] Product detail pages
- [x] Shopping cart
- [x] Checkout with Stripe
- [x] Checkout with Mobile Money (MTN, Orange, Airtel) - MOCKED
- [x] Order management
- [x] Supplier dashboard
- [x] Buyer dashboard
- [x] RFQ (Request for Quote) system
- [x] Real-time messaging interface
- [x] Notifications system (MOCKED emails)
- [x] Product reviews from orders
- [x] Favorites system
- [ ] Blog/News section (placeholder)

### Non-Functional Requirements
- Responsive design (mobile/tablet/desktop)
- French (primary) + English support
- Zone CEMAC coverage (6 countries)

## What's Been Implemented (March 20, 2026)

### Phase 1 - Core MVP
- ✅ FastAPI server with MongoDB
- ✅ User authentication (JWT)
- ✅ Categories CRUD (3 categories seeded)
- ✅ Products CRUD with search/filters (6 products seeded)
- ✅ Cart management
- ✅ Orders management
- ✅ Favorites system
- ✅ Stripe checkout integration
- ✅ Supplier statistics API
- ✅ AI recommendations endpoint (GPT-5.2)

### Phase 2 - Extended Features
- ✅ Logo personnalisé AfriSupply intégré
- ✅ RFQ (Request for Quote) system complet
  - Création de demandes de devis
  - Soumission de devis par fournisseurs
  - Acceptation/refus de devis par acheteurs
- ✅ Mobile Money payment (MOCKED)
  - MTN Mobile Money
  - Orange Money
  - Airtel Money
- ✅ Interface de messagerie temps réel
- ✅ Système de notifications
  - Notifications pour RFQs
  - Notifications pour commandes
  - Notifications pour avis
- ✅ Reviews système amélioré

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Core marketplace flow
- [x] RFQ system
- [x] Mobile Money payment
- [x] Messaging interface
- [x] Notifications

### P1 - High Priority
- [ ] Real Flutterwave integration for Mobile Money
- [ ] Real SendGrid integration for emails
- [ ] WebSocket real-time messaging

### P2 - Medium Priority
- [ ] Blog/News section for SEO
- [ ] Multi-language support (EN)
- [ ] Order tracking with status updates
- [ ] Supplier onboarding flow

### P3 - Low Priority
- [ ] Advanced analytics dashboard
- [ ] Bulk product upload
- [ ] Invoice generation
- [ ] API documentation

## Next Tasks
1. Integrate real Flutterwave API for Mobile Money
2. Integrate SendGrid for transactional emails
3. Add WebSocket for real-time chat
4. Create blog/news section
5. Add multi-language support

## Demo Credentials
- Buyer: buyer@afrisupply.com / buyer123
- Supplier: supplier@afrisupply.com / supplier123

## MOCKED Services
- Mobile Money payment (simulated flow)
- Email notifications (logged to console)
