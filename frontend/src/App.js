// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { Toaster } from "./components/ui/sonner";

import {
  HomePage,
  ProductsPage,
  ProductDetailPage,
  LoginPage,
  RegisterPage,
  CartPage,
  CheckoutPage,
} from "./pages";
import NotificationsPage from "./pages/NotificationsPage";
import MessagesPage from "./pages/MessagesPage";
import SuppliersPage from "./pages/SuppliersPage";
import RFQPage from "./pages/RFQPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import ProfilePage from "./pages/ProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import BlogPage from "./pages/BlogPage";
import LegalPage from "./pages/LegalPage";
// P4-24: i18n
import { LocaleProvider } from "./context/LocaleContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RequireBuyer } from "./components/auth/RequireBuyer";
import { RequireSupplier } from "./components/auth/RequireSupplier";
import DashboardRedirect from "./pages/DashboardRedirect";
import DashboardBuyer from "./pages/DashboardBuyer";
import DashboardSupplier from "./pages/DashboardSupplier";
import NewProductPage from "./pages/NewProductPage";
import EditProductPage from "./pages/EditProductPage";


function App() {
  return (
    <LocaleProvider>
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Routes publiques */}
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/suppliers/:supplierId" element={<SuppliersPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* P3-13: page blog */}
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:id" element={<BlogPage />} />
            {/* P4-22: pages légales */}
            <Route path="/terms" element={<LegalPage />} />
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/legal" element={<LegalPage />} />
            {/* P2-12: page mot de passe oublié */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Routes protégées - tout utilisateur connecté */}
            <Route element={<ProtectedRoute />}>
              <Route path="/cart" element={<CartPage />} />
              {/* P2-9: page profil utilisateur */}
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:partnerId" element={<MessagesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              {/* P1 FIX: /orders/:id est accessible à tout utilisateur connecté (acheteur ET fournisseur) */}
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              {/* P1 FIX: /rfq accessible aux buyers ET suppliers (RFQPage gère les deux rôles en interne) */}
              <Route path="/rfq" element={<RFQPage />} />
              <Route path="/rfq/:rfqId" element={<RFQPage />} />
            </Route>

            <Route path="/dashboard" element={<DashboardRedirect />} />

            {/* Routes acheteur uniquement */}
            <Route element={<RequireBuyer />}>
              <Route path="/dashboard/buyer" element={<DashboardBuyer />} />
            </Route>

            {/* Routes fournisseur uniquement */}
            <Route element={<RequireSupplier />}>
              <Route path="/dashboard/supplier" element={<DashboardSupplier />} />
              <Route path="/dashboard/products/new" element={<NewProductPage />} />
              <Route path="/dashboard/products/edit/:id" element={<EditProductPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<div>404 - Page non trouvée</div>} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </CartProvider>
    </AuthProvider>
    </LocaleProvider>
  );
}

export default App;