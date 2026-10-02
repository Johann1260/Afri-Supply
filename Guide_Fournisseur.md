# Guide Fournisseur — AfriSupply

## 1. Créer un compte fournisseur
- Inscription → sélectionner "Fournisseur"
- Confirmer l'email
- Soumettre les documents d'entreprise (registre commerce, patente, etc.)
- Attendre la validation admin (48h max)
- Vous ne pouvez pas vendre tant que votre compte n'est pas approuvé

## 2. Ma boutique (Storefront)
- Dashboard → onglet "Ma boutique"
- Personnaliser : URL custom (/store/votre-slug), slogan, description, certifications, année de création
- Votre boutique publique affiche vos badges, produits, note moyenne
- Les informations personnelles (nom, téléphone, email) ne sont jamais affichées

## 3. Badges
- **Vérifié** : compte approuvé + email confirmé
- **Documents Vérifiés** : 2+ documents validés
- **Silver/Gold/Platinum** : 5/20/50+ commandes livrées et payées
- **Top Évalué** : note ≥ 4.5 avec 10+ avis
- **Réponse Rapide** : 10+ devis soumis
- **Trade Assurance** : 3+ escrows complétés
- Les badges se calculent automatiquement et sont mis en cache 5 minutes

## 4. Gérer mes produits
- Dashboard → onglet "Produits" → "Ajouter un produit"
- Remplir : nom, description (FR/EN), catégorie, prix (XAF), unité, stock, spécifications techniques
- Ajouter des images (max 5Mo/image, formats JPG/PNG/WebP)
- Le produit est immédiatement visible dans le catalogue

## 5. Répondre aux devis (RFQ)
- Dashboard → onglet "RFQ"
- Voir les demandes reçues → soumettre un devis (prix + notes)
- L'acheteur reçoit une notification et peut accepter ou refuser
- Votre temps de réponse contribue au badge "Réponse Rapide"

## 6. Gérer les commandes
- Dashboard → onglet "Commandes"
- Workflow : En attente → **Confirmer** → **En traitement** → **Contrôle qualité** → **Expédier** → **En transit** → **Livré**
- À chaque étape, l'acheteur est notifié automatiquement
- **Frais de livraison** : fixez-les dans le détail de la commande (champ dédié)
- Le total de la commande est recalculé automatiquement (sous-total + frais)

## 7. Trade Assurance
- Si l'acheteur active Trade Assurance, les fonds sont bloqués en escrow
- Vous recevez les fonds uniquement quand l'acheteur confirme la réception
- En cas de litige, un administrateur arbitre

## 8. Messagerie
- Tous les échanges sont anonymisés (votre nom réel n'apparaît jamais)
- Les tentatives d'échange de coordonnées sont bloquées automatiquement
- Utilisez la messagerie pour discuter des détails techniques et des frais de livraison

## 9. Statistiques
- Dashboard → vue d'ensemble : commandes, revenus, produits, RFQ en attente
- Les données sont mises en cache Redis (1 minute) pour la performance