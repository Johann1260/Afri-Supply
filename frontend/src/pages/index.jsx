// src/pages/index.jsx — barrel export complet de toutes les pages
// App.jsx utilise des imports directs avec React.lazy() pour le lazy loading.
// Ce barrel est conservé pour les imports statiques éventuels (tests, scripts).

// ── Publiques ────────────────────────────────────────────────────────────────
export { default as HomePage }              from './HomePage';
export { default as ProductsPage }          from './ProductsPage';
export { default as ProductDetailPage }     from './ProductDetailPage';
export { default as CategoriesPage }        from './CategoriesPage';
export { default as SuppliersPage }         from './SuppliersPage';
export { default as StorefrontPage }        from './StorefrontPage';
export { default as BlogPage }              from './BlogPage';
export { default as LegalPage }             from './LegalPage';

// ── Auth ─────────────────────────────────────────────────────────────────────
export { default as LoginPage }             from './LoginPage';
export { default as RegisterPage }          from './RegisterPage';
export { default as ForgotPasswordPage }    from './ForgotPasswordPage';
export { default as ResetPasswordPage }     from './ResetPasswordPage';
export { default as VerifyEmailPage }       from './VerifyEmailPage';
export { default as ConfirmEmailChangePage } from './ConfirmEmailChangePage';

// ── Buyer ────────────────────────────────────────────────────────────────────
export { default as CartPage }              from './CartPage';
export { default as CheckoutPage }          from './CheckoutPage';
export { default as OrderDetailPage }       from './OrderDetailPage';
export { default as MessagesPage }          from './MessagesPage';
export { default as NotificationsPage }     from './NotificationsPage';
export { default as ProfilePage }           from './ProfilePage';
export { default as RFQPage }               from './RFQPage';
export { default as RFQDetailPage }         from './RFQDetailPage';
export { default as InvoicesPage }          from './InvoicesPage';

// ── Dashboards ───────────────────────────────────────────────────────────────
export { default as DashboardRedirect }     from './DashboardRedirect';
export { default as DashboardBuyer }        from './DashboardBuyer';
export { default as DashboardSupplier }     from './DashboardSupplier';

// ── Supplier ─────────────────────────────────────────────────────────────────
export { default as NewProductPage }        from './NewProductPage';
export { default as EditProductPage }       from './EditProductPage';
export { default as SupplierOnboardingPage } from './SupplierOnboardingPage';

// ── Admin ────────────────────────────────────────────────────────────────────
export { default as AdminDashboard }        from './AdminDashboard';
export { default as AdminMobileMoneyPage }  from './AdminMobileMoneyPage';
