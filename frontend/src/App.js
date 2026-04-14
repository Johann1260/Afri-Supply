// src/App.js
// Lazy loading complet : chaque page est chargée à la demande
// → bundle initial réduit, temps de chargement initial amélioré

import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { LocaleProvider } from "./context/LocaleContext";
import { Toaster } from "./components/ui/sonner";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RequireBuyer } from "./components/auth/RequireBuyer";
import { RequireSupplier } from "./components/auth/RequireSupplier";

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center text-center p-8">
          <div>
            <p className="text-7xl font-bold text-slate-200 mb-4">500</p>
            <h1 className="text-2xl font-semibold text-slate-800 mb-2">Une erreur est survenue</h1>
            <p className="text-slate-500 mb-6">Veuillez rafraîchir la page ou réessayer plus tard.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-accent hover:underline font-medium"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


// ── Lazy imports ─────────────────────────────────────────────────────────────
// Pages publiques (chargées à la demande)
const HomePage           = lazy(() => import("./pages/HomePage"));
const ProductsPage       = lazy(() => import("./pages/ProductsPage"));
const ProductDetailPage  = lazy(() => import("./pages/ProductDetailPage"));
const LoginPage          = lazy(() => import("./pages/LoginPage"));
const RegisterPage       = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const VerifyEmailPage    = lazy(() => import("./pages/VerifyEmailPage"));
const SuppliersPage      = lazy(() => import("./pages/SuppliersPage"));
const BlogPage           = lazy(() => import("./pages/BlogPage"));
const LegalPage          = lazy(() => import("./pages/LegalPage"));

// Pages protégées
const CartPage           = lazy(() => import("./pages/CartPage"));
const CheckoutPage       = lazy(() => import("./pages/CheckoutPage"));
const OrderDetailPage    = lazy(() => import("./pages/OrderDetailPage"));
const MessagesPage       = lazy(() => import("./pages/MessagesPage"));
const NotificationsPage  = lazy(() => import("./pages/NotificationsPage"));
const ProfilePage        = lazy(() => import("./pages/ProfilePage"));
const RFQPage            = lazy(() => import("./pages/RFQPage"));

// Dashboards
const DashboardRedirect  = lazy(() => import("./pages/DashboardRedirect"));
const DashboardBuyer     = lazy(() => import("./pages/DashboardBuyer"));
const DashboardSupplier  = lazy(() => import("./pages/DashboardSupplier"));

// Supplier tools
const NewProductPage     = lazy(() => import("./pages/NewProductPage"));
const EditProductPage    = lazy(() => import("./pages/EditProductPage"));

// ── Fallback de chargement ────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 text-sm">Chargement...</p>
    </div>
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Routes publiques ─────────────────────────────────── */}
                <Route path="/"                   element={<HomePage />} />
                <Route path="/products"           element={<ProductsPage />} />
                <Route path="/categories"         element={<ProductsPage />} />
                <Route path="/products/:id"       element={<ProductDetailPage />} />
                <Route path="/suppliers"          element={<SuppliersPage />} />
                <Route path="/suppliers/:supplierId" element={<SuppliersPage />} />
                <Route path="/login"              element={<LoginPage />} />
                <Route path="/register"           element={<RegisterPage />} />
                <Route path="/forgot-password"    element={<ForgotPasswordPage />} />
                {/* Vérification email (lien envoyé par email) */}
                <Route path="/verify-email"       element={<VerifyEmailPage />} />
                <Route path="/blog"               element={<BlogPage />} />
                <Route path="/blog/:id"           element={<BlogPage />} />
                {/* Pages légales */}
                <Route path="/terms"              element={<LegalPage />} />
                <Route path="/privacy"            element={<LegalPage />} />
                <Route path="/legal"              element={<LegalPage />} />

                {/* ── Routes protégées (tout utilisateur connecté) ──────── */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/cart"                   element={<CartPage />} />
                  <Route path="/checkout"               element={<CheckoutPage />} />
                  <Route path="/orders/:id"             element={<OrderDetailPage />} />
                  <Route path="/messages"               element={<MessagesPage />} />
                  <Route path="/messages/:partnerId"    element={<MessagesPage />} />
                  <Route path="/notifications"          element={<NotificationsPage />} />
                  <Route path="/profile"                element={<ProfilePage />} />
                  {/* RFQ : acheteurs ET fournisseurs */}
                  <Route path="/rfq"                    element={<RFQPage />} />
                  <Route path="/rfq/:rfqId"             element={<RFQPage />} />
                </Route>

                {/* Dashboard — redirect selon le rôle */}
                <Route path="/dashboard" element={
                  <Suspense fallback={<PageLoader />}>
                    <DashboardRedirect />
                  </Suspense>
                } />

                {/* ── Routes acheteur ────────────────────────────────────── */}
                <Route element={<RequireBuyer />}>
                  <Route path="/dashboard/buyer" element={<DashboardBuyer />} />
                </Route>

                {/* ── Routes fournisseur ─────────────────────────────────── */}
                <Route element={<RequireSupplier />}>
                  <Route path="/dashboard/supplier"         element={<DashboardSupplier />} />
                  <Route path="/dashboard/products/new"     element={<NewProductPage />} />
                  <Route path="/dashboard/products/edit/:id" element={<EditProductPage />} />
                </Route>

                {/* ── 404 ──────────────────────────────────────────────── */}
                <Route path="*" element={
                  <div className="min-h-screen flex items-center justify-center text-center p-8">
                    <div>
                      <p className="text-7xl font-bold text-slate-200 mb-4">404</p>
                      <h1 className="text-2xl font-semibold text-slate-800 mb-2">Page introuvable</h1>
                      <p className="text-slate-500 mb-6">La page que vous cherchez n'existe pas.</p>
                      <a href="/" className="text-accent hover:underline font-medium">Retour à l'accueil</a>
                    </div>
                  </div>
                } />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>

          <Toaster position="top-right" richColors />
        </CartProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}

export default App;