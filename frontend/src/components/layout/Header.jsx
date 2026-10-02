import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLocale } from '../../context/LocaleContext';
import {
  ShoppingCart, User, List, X, SignOut,
  Package, Heart, ChatCircle, Bell,
  FileText, GearSix, ShieldWarning, Receipt
} from '@phosphor-icons/react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { SearchAutocomplete } from '../search/SearchAutocomplete';
import { notificationsAPI } from '../../lib/api';

export const Header = () => {
  const { user, isAuthenticated, isAdmin, isBuyer, logout } = useAuth();
  const { cart }   = useCart();
  const { locale, setLocale, t } = useLocale();
  const navigate   = useNavigate();
  const location   = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);

  useEffect(() => {
    if (!isAuthenticated) { setUnreadCount(0); return; }
    const fetch = async () => {
      try {
        const r = await notificationsAPI.getUnreadCount();
        setUnreadCount(r.data.unread_count || 0);
      } catch { /* silencieux */ }
    };
    fetch();
    const iv = setInterval(() => { if (!document.hidden) fetch(); }, 25000);
    const handler = () => fetch();
    window.addEventListener('notifications-read', handler);
    return () => { clearInterval(iv); window.removeEventListener('notifications-read', handler); };
  }, [isAuthenticated]);

  const handleLogout = () => { logout(); navigate('/'); };

  const navLinks = [
    { href: '/products',   label: t('nav.products') },
    { href: '/categories', label: t('nav.categories') },
    { href: '/suppliers',  label: t('nav.suppliers') },
    { href: '/blog',       label: t('nav.news') },
  ];

  return (
    <header className="sticky top-0 z-50 glass-header">
      {/* Top bar */}
      <div className="bg-primary text-white py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm">
          <p className="hidden sm:block">
            {locale === 'fr' ? "Marketplace B2B Industrielle pour l'Afrique Centrale" : 'B2B Industrial Marketplace for Central Africa'}
          </p>
          <div className="flex items-center gap-1">
            {['fr','en'].map((l, i) => (
              <React.Fragment key={l}>
                {i > 0 && <span className="text-white/40">|</span>}
                <button
                  onClick={() => setLocale(l)}
                  className={`px-2 py-0.5 rounded text-sm font-medium transition-colors ${locale === l ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
                >
                  {l.toUpperCase()}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0" data-testid="logo-link">
            <img src="/logo.webp" alt="AfriSupply" className="h-10 w-auto" />
          </Link>

          {/* Search — autocomplete */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <SearchAutocomplete className="w-full" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-slate-600 hover:text-primary transition-colors" data-testid="cart-link">
              <ShoppingCart className="w-6 h-6" weight="bold" />
              {cart.item_count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cart.item_count}
                </span>
              )}
            </Link>

            {/* Notifications */}
            {isAuthenticated && (
              <Link to="/notifications" className="relative p-2 text-slate-600 hover:text-primary transition-colors" data-testid="notifications-link">
                <Bell className="w-6 h-6" weight="bold" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )}

            {/* User menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu-trigger">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" weight="bold" />
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-slate-700">
                      {user?.full_name?.split(' ')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b">
                    <p className="font-medium text-sm">{user?.full_name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>

                  {/* Admin link */}
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="flex items-center gap-2 text-purple-700 font-medium" data-testid="admin-link">
                          <ShieldWarning className="w-4 h-4" weight="fill" />
                          Administration
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2" data-testid="dashboard-link">
                      <Package className="w-4 h-4" />
                      {t('nav.dashboard')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2" data-testid="profile-link">
                      <GearSix className="w-4 h-4" />
                      {t('nav.profile')}
                    </Link>
                  </DropdownMenuItem>

                  {/* Favoris (acheteurs) */}
                  {isBuyer && (
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard/buyer" className="flex items-center gap-2" data-testid="favorites-link">
                        <Heart className="w-4 h-4" />
                        {t('nav.favorites')}
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem asChild>
                    <Link to="/messages" className="flex items-center gap-2" data-testid="messages-link">
                      <ChatCircle className="w-4 h-4" />
                      {t('nav.messages')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/rfq" className="flex items-center gap-2" data-testid="rfq-link">
                      <FileText className="w-4 h-4" />
                      {t('nav.rfq')}
                    </Link>
                  </DropdownMenuItem>

                  {/* Factures (acheteurs) */}
                  {isBuyer && (
                    <DropdownMenuItem asChild>
                      <Link to="/invoices" className="flex items-center gap-2" data-testid="invoices-link">
                        <Receipt className="w-4 h-4" />
                        {t('nav.invoices')}
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-600 focus:text-red-600"
                    data-testid="logout-button"
                  >
                    <SignOut className="w-4 h-4 mr-2" />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login"><Button variant="ghost" size="sm" data-testid="login-button">{t('nav.login')}</Button></Link>
                <Link to="/register"><Button size="sm" className="bg-accent hover:bg-accent-hover" data-testid="register-button">{t('nav.register')}</Button></Link>
              </div>
            )}

            <button
              className="md:hidden p-2 text-slate-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <List className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 mt-4 pt-4 border-t border-slate-200">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`text-sm font-medium transition-colors ${
                location.pathname === link.href || location.pathname.startsWith(link.href + '/')
                  ? 'text-accent' : 'text-slate-600 hover:text-primary'
              }`}
              data-testid={`nav-${link.label.toLowerCase().replace(/\s/g,'-')}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200">
          <div className="p-4">
            <SearchAutocomplete onClose={() => setMobileMenuOpen(false)} />
          </div>
          <nav className="px-4 pb-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`block py-2 px-4 rounded-lg font-medium text-sm ${
                  location.pathname === link.href ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && (
              <>
                <Link to="/profile"   className="block py-2 px-4 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-50" onClick={() => setMobileMenuOpen(false)}>{t('nav.profile')}</Link>
                <Link to="/dashboard" className="block py-2 px-4 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-50" onClick={() => setMobileMenuOpen(false)}>{t('nav.dashboard')}</Link>
                {isBuyer && <Link to="/invoices" className="block py-2 px-4 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-50" onClick={() => setMobileMenuOpen(false)}>{t('nav.invoices')}</Link>}
                {isAdmin && <Link to="/admin"   className="block py-2 px-4 rounded-lg font-medium text-sm text-purple-700 hover:bg-purple-50" onClick={() => setMobileMenuOpen(false)}>{t('nav.admin')}</Link>}
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
export const MemoizedHeader = React.memo(Header);
