// src/pages/index.js — barrel export de toutes les pages
// App.js utilise des imports directs avec React.lazy() pour le lazy loading
// Ce fichier est conservé pour les imports statiques éventuels

export { default as HomePage }          from './HomePage';
export { default as ProductsPage }      from './ProductsPage';
export { default as ProductDetailPage } from './ProductDetailPage';
export { default as LoginPage }         from './LoginPage';
export { default as RegisterPage }      from './RegisterPage';
export { default as CartPage }          from './CartPage';
export { default as CheckoutPage }      from './CheckoutPage';
export { default as DashboardRedirect } from './DashboardRedirect';
export { default as DashboardSupplier } from './DashboardSupplier';
export { default as DashboardBuyer }    from './DashboardBuyer';
export { default as NotificationsPage } from './NotificationsPage';
export { default as MessagesPage }      from './MessagesPage';
export { default as SuppliersPage }     from './SuppliersPage';
export { default as RFQPage }           from './RFQPage';
export { default as OrderDetailPage }   from './OrderDetailPage';
export { default as ProfilePage }       from './ProfilePage';
export { default as ForgotPasswordPage } from './ForgotPasswordPage';
export { default as VerifyEmailPage }   from './VerifyEmailPage';
export { default as BlogPage }          from './BlogPage';
export { default as LegalPage }         from './LegalPage';
export { default as NewProductPage }    from './NewProductPage';
export { default as EditProductPage }   from './EditProductPage';