# Stratégie Anti-Contournement – AfriSupply

**Objectif** : Empêcher les utilisateurs (acheteurs et fournisseurs) de contourner la plateforme tout en rendant l’utilisation d’AfriSupply **plus avantageuse** que le contournement.

---

## Types de Contournements Identifiés

### 1. Désintermédiation / Contournement Relationnel
- Échange de numéros dans le chat
- Envoi d’emails / WhatsApp / Telegram
- Contact direct après une première mise en relation
- Finalisation de la transaction hors plateforme
- Négociation directe après le premier contact
- Migration vers une relation directe après la première transaction

### 2. Contournement Paiement
- Paiement cash direct au fournisseur
- Mobile Money direct au fournisseur
- Virement bancaire hors plateforme
- Paiement partiel OFF plateforme

### 3. Sous-déclaration / Fractionnement
- Déclaration d’une partie seulement de la commande
- Fractionnement des commandes
- Ajout d’accessoires ou produits "hors facture"
- Renégociation hors plateforme

### 4. Migration OFF après transaction
- Utilisation d’AfriSupply une seule fois puis sortie
- Continuation de la relation en direct
- Coupure de la plateforme après le premier contact

### 5. Fraude & Faux Profils
- Faux fournisseurs (inventent stock, mentent sur capacité)
- Intermédiaires opportunistes
- Création de plusieurs comptes
- Contournement de sanctions ou restrictions
- Manipulation de la concurrence

### 6. Extraction d’information sans transaction
- Navigation sans intention d’acheter
- Extraction d’informations fournisseurs puis départ

---

## Manifestations Concrètes

- Messages du type : “appelle-moi”, “en privé”, “je t’envoie directement”
- Numéros de téléphone ou WhatsApp dans le chat ou les devis
- PDF avec contacts cachés
- Proposition de remise si paiement direct
- Demande de réduction si paiement hors plateforme
- Commande officielle réduite artificiellement

---

## Blocages Techniques & Produit

**Chat & Communication**
- Blocage automatique des numéros de téléphone, WhatsApp, emails, liens externes
- Détection et blocage des phrases de contournement
- Anonymisation des contacts (nom entreprise anonymisé : “Entreprise XXR033”)
- Contact réel débloqué **uniquement après commande payée**

**Paiement**
- Paiement obligatoire via la plateforme (escrow)
- Impossible de finaliser une commande sans paiement sur AfriSupply
- Statut de commande bloqué tant que le paiement n’est pas validé

**RFQ & Commandes**
- RFQ anonymisées (pas de contact direct)
- Une commande = un paiement complet
- Détection et blocage des fractionnements / sous-déclarations

**Vérification des utilisateurs**
- 1 entreprise = 1 compte
- Vérification manuelle initiale + badge “Vérifié AfriSupply”
- Limitation des actions pour les comptes non vérifiés

---

## Leviers Économiques & Incitations

**Pour les fournisseurs**
- Visibilité x3 pour les fournisseurs vérifiés
- Accès prioritaire aux grosses RFQ
- Meilleur classement dans les recherches
- Réputation et historique consolidés sur la plateforme

**Pour les acheteurs**
- Gain de temps énorme vs recherche terrain
- Multi-devis instantanés
- Garantie paiement et livraison
- Accès à plus de fournisseurs vérifiés

**Incitation forte**
- Plus tu passes par AfriSupply, plus tu gagnes en visibilité, crédibilité et clients.
- Hors plateforme = perte de protection, historique et avantages.

---

**Stratégie de Marge – Tableau Complet**

*(Le tableau du PDF est intégré ci-dessous sous forme Markdown claire)*

| Type de contournement              | Ce que font les gens                          | Manifestation concrète                          | Blocage (actions produit)                     | Leviers économiques / Incitation forte                  |
|------------------------------------|-----------------------------------------------|------------------------------------------------|-----------------------------------------------|---------------------------------------------------------|
| Désintermédiation relationnelle    | Échange numéros, WhatsApp, emails            | “Appelle-moi”, numéros dans chat              | Filtrage automatique chat + anonymisation     | Visibilité x3 + badge vérifié                           |
| Contournement paiement             | Paiement direct Mobile Money / virement      | “Je t’envoie directement l’argent”            | Paiement obligatoire via plateforme           | Garantie paiement + escrow                              |
| Sous-déclaration / Fractionnement  | Déclarer seulement une partie de la commande | Commande officielle réduite + accessoires OFF | Structure commande imposée + détection        | Remises selon volume traité sur plateforme              |
| Migration OFF après transaction    | Continuer en direct après 1ère commande      | “On travaille directement maintenant”         | Historique et avantages uniquement ON         | Recommandation en 1 clic + fidélité progressive        |
| Fraude & faux profils              | Faux stock, multi-comptes                    | Prix irréalistes, réponses multiples          | Vérification manuelle + 1 compte / entreprise | Badge vérifié + limitation des non-vérifiés             |
| Extraction sans transaction        | Navigation purement informative              | Navigation sans action                        | Contacts floutés + déblocage après action     | CTA forts et valeur ajoutée immédiate                   |

---

**Prochaines étapes recommandées pour Claude :**
- Implémenter en priorité le filtrage intelligent du chat
- Mettre en place l’anonymisation des contacts
- Verrouiller le déblocage après paiement
- Renforcer les RFQ anonymisées

Tu peux maintenant copier-coller ce fichier entier dans Claude Code.