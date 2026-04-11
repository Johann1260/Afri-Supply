import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { Layout } from '../components/layout';

// ─── Contenu ────────────────────────────────────────────────────────────────

const TERMS_CONTENT = {
  title: 'Conditions Générales d\'Utilisation',
  lastUpdated: '1er janvier 2025',
  sections: [
    {
      heading: 'Objet',
      body: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation
de la plateforme AfriSupply, marketplace B2B industrielle opérée par AfriSupply SAS,
société enregistrée à Douala, Cameroun. En utilisant le service, vous acceptez sans
réserve les présentes CGU.`,
    },
    {
      heading: 'Inscription et comptes',
      body: `L'accès à certaines fonctionnalités nécessite la création d'un compte. Vous vous engagez
à fournir des informations exactes et à maintenir la confidentialité de vos identifiants.
AfriSupply se réserve le droit de suspendre tout compte en cas de violation des CGU.`,
    },
    {
      heading: 'Utilisation du service',
      body: `La plateforme est réservée aux transactions B2B entre professionnels. Toute utilisation
frauduleuse, publication de fausses informations produit ou tentative de contournement
des processus de paiement est strictement interdite et expose l'utilisateur à des
poursuites judiciaires.`,
    },
    {
      heading: 'Transactions et paiements',
      body: `AfriSupply facilite la mise en relation entre acheteurs et fournisseurs mais n'est pas
partie au contrat de vente. Les paiements sont traités par des prestataires certifiés
(Stripe, opérateurs Mobile Money). Toute contestation de transaction doit être signalée
dans les 14 jours suivant la livraison.`,
    },
    {
      heading: 'Responsabilité',
      body: `AfriSupply ne peut être tenu responsable des dommages indirects résultant de
l'utilisation de la plateforme, d'interruptions de service ou d'erreurs des fournisseurs
tiers. La responsabilité directe d'AfriSupply est limitée au montant des frais payés par
l'utilisateur au cours des 12 derniers mois.`,
    },
    {
      heading: 'Modification et résiliation',
      body: `AfriSupply peut modifier les présentes CGU à tout moment. Les utilisateurs seront
notifiés par email au moins 30 jours avant l'entrée en vigueur des modifications.
Tout utilisateur peut résilier son compte à tout moment depuis la page Profil.`,
    },
    {
      heading: 'Droit applicable',
      body: `Les présentes CGU sont régies par le droit camerounais. Tout litige sera soumis
à la compétence exclusive des tribunaux de Douala, Cameroun, sous réserve de toute
disposition impérative contraire.`,
    },
  ],
};

const PRIVACY_CONTENT = {
  title: 'Politique de Confidentialité',
  lastUpdated: '1er janvier 2025',
  sections: [
    {
      heading: 'Données collectées',
      body: `Nous collectons les informations que vous nous fournissez lors de l'inscription
(nom, email, téléphone, entreprise, localisation), les données de navigation (pages visitées,
recherches effectuées) et les données transactionnelles (commandes, paiements, messages).`,
    },
    {
      heading: 'Utilisation des données',
      body: `Vos données sont utilisées pour la fourniture du service, l'amélioration de la
plateforme, la personnalisation des recommandations, l'envoi de notifications transactionnelles
et, avec votre consentement, la communication marketing. Nous n'vendons jamais vos
données à des tiers.`,
    },
    {
      heading: 'Partage des données',
      body: `Vos données peuvent être partagées avec nos prestataires de services (hébergement,
paiement, email) dans le strict cadre de la fourniture du service, et avec les contreparties
de vos transactions (nom d'entreprise et ville uniquement). Aucune donnée personnelle
n'est cédée à des tiers à des fins commerciales.`,
    },
    {
      heading: 'Conservation',
      body: `Les données de compte sont conservées pendant la durée de la relation contractuelle
et 3 ans après la clôture du compte. Les données de transaction sont conservées 10 ans
conformément aux obligations comptables et fiscales.`,
    },
    {
      heading: 'Vos droits',
      body: `Conformément aux lois applicables sur la protection des données, vous disposez
d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition.
Pour exercer ces droits, contactez-nous à privacy@afrisupply.com.`,
    },
    {
      heading: 'Cookies',
      body: `Nous utilisons des cookies techniques (indispensables au fonctionnement), analytiques
(mesure d'audience anonymisée via Posthog) et fonctionnels (préférences de langue,
session). Vous pouvez gérer vos préférences cookies via les paramètres de votre navigateur.`,
    },
    {
      heading: 'Contact',
      body: `Délégué à la Protection des Données : dpo@afrisupply.com
AfriSupply SAS, BP 1234, Douala, Cameroun.`,
    },
  ],
};

const LEGAL_CONTENT = {
  title: 'Mentions Légales',
  lastUpdated: '1er janvier 2025',
  sections: [
    {
      heading: 'Éditeur du site',
      body: `AfriSupply SAS
Siège social : Rue de la Douane, Bonanjo, Douala, Cameroun
Capital social : 10 000 000 XAF
RCCM : RC/DLA/2024/B/XXXX
Directeur de la publication : [Nom du dirigeant]`,
    },
    {
      heading: 'Hébergement',
      body: `Le site AfriSupply est hébergé par :
Amazon Web Services (AWS), région eu-west-1 (Irlande).
Amazon Web Services EMEA SARL, 38 avenue John F. Kennedy, L-1855, Luxembourg.`,
    },
    {
      heading: 'Propriété intellectuelle',
      body: `L'ensemble du contenu de ce site (textes, images, logos, icônes, données) est
la propriété exclusive d'AfriSupply SAS ou de ses partenaires et est protégé par
les lois applicables sur la propriété intellectuelle. Toute reproduction, distribution
ou utilisation sans autorisation écrite préalable est interdite.`,
    },
    {
      heading: 'Limitation de responsabilité',
      body: `AfriSupply s'efforce d'assurer l'exactitude et la mise à jour des informations
publiées. Toutefois, AfriSupply ne saurait être tenu responsable d'erreurs,
d'omissions ou des résultats obtenus par l'usage de ces informations.`,
    },
    {
      heading: 'Contact',
      body: `Pour toute question relative au site :
Email : contact@afrisupply.com
Téléphone : +237 690 000 000
Horaires : du lundi au vendredi, 8h–18h (WAT)`,
    },
  ],
};

const PAGES = {
  terms: TERMS_CONTENT,
  privacy: PRIVACY_CONTENT,
  legal: LEGAL_CONTENT,
};

const BACK_LABELS = {
  terms: 'Conditions Générales',
  privacy: 'Confidentialité',
  legal: 'Mentions Légales',
};

// ─── Composant ──────────────────────────────────────────────────────────────

const LegalPage = () => {
  // Dériver le type depuis le pathname (terms, privacy, legal)
  const pathname = window.location.pathname.replace('/', '');
  const type = Object.keys(PAGES).find((k) => pathname.includes(k)) || 'terms';
  const page = PAGES[type] || PAGES.terms;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Back */}
        <Link
          to="/register"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-primary text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l'inscription
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="font-heading font-bold text-3xl text-slate-900 mb-2">{page.title}</h1>
          <p className="text-sm text-slate-400">Dernière mise à jour : {page.lastUpdated}</p>
        </div>

        {/* Navigation rapide entre pages légales */}
        <div className="flex gap-3 mb-10 flex-wrap">
          {Object.entries(BACK_LABELS).map(([key, label]) => (
            <Link
              key={key}
              to={`/${key === 'terms' ? 'terms' : key === 'privacy' ? 'privacy' : 'legal'}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                type === key
                  ? 'bg-primary text-white border-primary'
                  : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Contenu */}
        <div className="space-y-8">
          {page.sections.map((section, i) => (
            <section key={i}>
              <h2 className="font-heading font-semibold text-lg text-slate-900 mb-3">
                {i + 1}. {section.heading}
              </h2>
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">{section.body}</p>
            </section>
          ))}
        </div>

        {/* Footer légal */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-xs text-slate-400 text-center">
            © {new Date().getFullYear()} AfriSupply SAS — Tous droits réservés
          </p>
          <div className="flex justify-center gap-6 mt-3 text-xs">
            <Link to="/terms" className="text-slate-400 hover:text-accent transition-colors">CGU</Link>
            <Link to="/privacy" className="text-slate-400 hover:text-accent transition-colors">Confidentialité</Link>
            <Link to="/legal" className="text-slate-400 hover:text-accent transition-colors">Mentions légales</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LegalPage;