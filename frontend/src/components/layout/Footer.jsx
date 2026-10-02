// ═══════════════════════════════════════════════════════════════════════════════
// Footer.js — i18n complète
// ═══════════════════════════════════════════════════════════════════════════════
import React from "react";
import { Link } from "react-router-dom";
import {
  EnvelopeSimple,
  Phone,
  MapPin,
  LinkedinLogo,
  TwitterLogo,
  FacebookLogo,
} from "@phosphor-icons/react";
import { useLocale } from "../../context/LocaleContext";

export const Footer = () => {
  const { t } = useLocale();
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    marketplace: [
      { label: t("nav.products"), href: "/products" },
      { label: t("nav.categories"), href: "/categories" },
      { label: t("nav.suppliers"), href: "/suppliers" },
    ],
    company: [
      { label: t("nav.news"), href: "/blog" },
      { label: t("nav.terms2"), href: "/terms" },
      { label: t("nav.privacy"), href: "/privacy" },
    ],
    support: [
      { label: t("nav.register2"), href: "/register?type=supplier" },
      { label: t("nav.register3"), href: "/register?type=buyer" },
      { label: t("nav.legal"), href: "/legal" },
    ],
    legal: [
      { label: t("nav.terms1"), href: "/terms" },
      { label: t("nav.privacy"), href: "/privacy" },
      { label: t("nav.legal"), href: "/legal" },
    ],
  };

  const countries = [
    "Cameroun",
    "Gabon",
    "Congo",
    "Tchad",
    "Guinée Équatoriale",
    "Centrafrique",
  ];

  return (
    <footer className="bg-primary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <img src="/logo-footer.webp" alt="AfriSupply" className="h-12 w-auto" />
            </Link>
            <p className="text-white/70 mb-6 max-w-sm">{t("nav.tagline")}</p>
            <div className="space-y-3">
              <a
                href="mailto:contact@afrisupply.com"
                className="flex items-center gap-3 text-white/70 hover:text-white transition-colors"
              >
                <EnvelopeSimple className="w-5 h-5" />
                contact@afrisupply.com
              </a>
              <a
                href="tel:+237656179221"
                className="flex items-center gap-3 text-white/70 hover:text-white transition-colors"
              >
                <Phone className="w-5 h-5" />
                +237 656 179 221
              </a>
              <p className="flex items-center gap-3 text-white/70">
                <MapPin className="w-5 h-5" />
                {t("location.label")}
              </p>
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <h3 className="font-heading font-bold text-lg mb-4">Marketplace</h3>
            <ul className="space-y-3">
              {footerLinks.marketplace.map((l) => (
                <li key={l.href}>
                  <Link
                    to={l.href}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-heading font-bold text-lg mb-4">
              {t("company.title")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map((l) => (
                <li key={l.href}>
                  <Link
                    to={l.href}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-heading font-bold text-lg mb-4">Support</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((l) => (
                <li key={l.href}>
                  <Link
                    to={l.href}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CEMAC */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-sm text-white/60 mb-4">{t("nav.tagline")} :</p>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <span
                key={c}
                className="px-3 py-1 bg-white/10 rounded-md text-sm"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-white/60">
              © {currentYear} AfriSupply. Tous droits réservés.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              {footerLinks.legal.map((l) => (
                <Link
                  key={l.href}
                  to={l.href}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-white/60 hover:text-white transition-colors"
              >
                <LinkedinLogo className="w-5 h-5" weight="fill" />
              </a>
              <a
                href="#"
                className="text-white/60 hover:text-white transition-colors"
              >
                <TwitterLogo className="w-5 h-5" weight="fill" />
              </a>
              <a
                href="#"
                className="text-white/60 hover:text-white transition-colors"
              >
                <FacebookLogo className="w-5 h-5" weight="fill" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
