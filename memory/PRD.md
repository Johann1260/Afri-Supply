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
- **Payments**: Stripe (with Emergent integration)
- **AI**: OpenAI GPT-5.2 for product recommendations (Emergent LLM Key)

### Design System
- Primary Color: #034168 (Industrial Blue)
- Accent Color: #FF6A00 (Action Orange)
- Typography: Chivo (headings), Manrope (body), IBM Plex Mono (codes)
- Icons: Phosphor Icons

## User Personas

### 1. Supplier (Fournisseur)
- Industrial suppliers in CEMAC region
- Manage products, orders, statistics
- Dashboard with revenue analytics

### 2. Buyer (Acheteur)
- B2B companies buying industrial supplies
- Browse products, place orders
- Track orders, manage favorites

## Core Requirements (Static)

### Functional Requirements
- [x] User registration/authentication (buyer/supplier)
- [x] Product catalog with search and filters
- [x] Product detail pages
- [x] Shopping cart
- [x] Checkout with Stripe
- [x] Order management
- [x] Supplier dashboard
- [x] Buyer dashboard
- [ ] Real-time messaging (WebSocket)
- [ ] Product reviews
- [ ] Mobile Money payment
- [ ] Email notifications (SendGrid)
- [ ] Blog/News section

### Non-Functional Requirements
- Responsive design (mobile/tablet/desktop)
- French (primary) + English support
- Zone CEMAC coverage (6 countries)

## What's Been Implemented (March 20, 2026)

### Backend (100%)
- ✅ FastAPI server with MongoDB
- ✅ User authentication (JWT)
- ✅ Categories CRUD
- ✅ Products CRUD with search/filters
- ✅ Cart management
- ✅ Orders management
- ✅ Favorites system
- ✅ Stripe checkout integration
- ✅ Supplier statistics API
- ✅ AI recommendations endpoint (GPT-5.2)
- ✅ WebSocket setup for chat
- ✅ Seed data (3 categories, 6 products, demo users)

### Frontend (95%)
- ✅ Homepage with hero, categories, popular products
- ✅ Products listing with filters (search, category, price)
- ✅ Product detail page
- ✅ Login/Register pages
- ✅ Cart page
- ✅ Checkout page with Stripe redirect
- ✅ Dashboard (buyer/supplier views)
- ✅ Responsive header & footer
- ✅ Custom design system (blue/orange theme)

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Core marketplace flow

### P1 - High Priority
- [ ] Real-time chat messaging UI
- [ ] Mobile Money integration (Flutterwave)
- [ ] Email notifications (SendGrid)
- [ ] Product reviews UI

### P2 - Medium Priority
- [ ] Blog/News section
- [ ] Supplier onboarding flow
- [ ] Order tracking with status updates
- [ ] Multi-language support (EN)

### P3 - Low Priority
- [ ] Advanced analytics dashboard
- [ ] Bulk product upload
- [ ] Invoice generation
- [ ] API documentation

## Next Tasks
1. Complete real-time chat UI with WebSocket
2. Add Mobile Money payment option
3. Implement product review system
4. Add email notifications for orders
5. Create blog/news section for SEO

## Demo Credentials
- Buyer: buyer@afrisupply.com / buyer123
- Supplier: supplier@afrisupply.com / supplier123
