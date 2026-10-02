# Guide Administrateur — AfriSupply

## 1. Accès
- Compte avec `user_type: "admin"` (créé via seed ou MongoDB direct)
- Dashboard admin accessible via `/admin`
- Docs API Swagger : `/docs` (désactivé en production)

## 2. Vue d'ensemble
- Stats en temps réel : utilisateurs, fournisseurs, commandes, revenus, produits
- Graphique revenus mensuels (endpoint `/admin/revenue`)

## 3. Gestion des utilisateurs
- Onglet "Utilisateurs" : liste paginée (15/page) avec recherche + filtre par type
- Actions : approuver, suspendre, supprimer un compte

## 4. Validation fournisseurs
- Onglet "Fournisseurs" : liste des comptes en attente de validation
- Voir les documents soumis (PDF/images dans /uploads/documents/)
- **Approuver** : le fournisseur passe en statut "active" + email de confirmation
- **Rejeter** : le fournisseur reçoit un email de refus
- Un fournisseur non approuvé ne peut ni vendre ni accéder au dashboard supplier

## 5. Gestion des commandes
- Onglet "Commandes" : toutes les commandes avec statut, montant, dates
- Vue en lecture seule (les transitions de statut sont gérées par buyer/supplier)

## 6. Trade Assurance & Litiges
- Onglet "Trade Assurance" :
  - Liste de tous les escrows actifs (montant, statut, dates)
  - **Litiges ouverts** : affichés en priorité avec raison et description
  - Actions admin :
    - **Rembourser** : les fonds retournent à l'acheteur
    - **Libérer** : les fonds vont au fournisseur
  - Chaque résolution met à jour l'escrow, la commande, et notifie les parties

## 7. Anti-bypass
- Onglet "Anti-bypass" : liste des tentatives de contournement
- Détails : contenu original, expéditeur, destinataire, date
- Les messages sont bloqués automatiquement — l'admin surveille les récidives

## 8. Gestion des produits
- Onglet "Produits" : liste tous les produits de tous les fournisseurs
- Actions : approuver ou rejeter un produit

## 9. Catégories
- Créer/supprimer des catégories (nom FR, nom EN, icône, description)
- Le cache catégories Redis est invalidé automatiquement

## 10. Blog
- Créer/modifier/supprimer des articles (FR/EN)
- Gérer la publication (brouillon → publié)

## 11. Opérations

```bash
make seed           # Peupler la base avec données de test
make test           # Lancer les 65 tests
curl /api/health    # Healthcheck
```

### Variables critiques en production
- `ENVIRONMENT=production` → désactive /docs, /seed, localhost CORS
- `JWT_SECRET` → min 64 chars, unique par environnement
- `STRIPE_WEBHOOK_SECRET` → obligatoire pour confirmer les paiements
- `MONGO_URL` → MongoDB Atlas recommandé
- `REDIS_URL` → Upstash recommandé (optionnel mais améliore les perfs)

### Monitoring
- `/api/health` : healthcheck JSON
- Logs structurés (uvicorn/gunicorn)
- MongoDB indexes créés au startup (30+)
- Redis : graceful degradation si indisponible