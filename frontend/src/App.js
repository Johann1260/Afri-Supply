// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { Toaster } from "./components/ui/sonner";

// import {
//   ProtectedRoute,
//   RequireBuyer,
//   RequireSupplier,
// } from "./components/auth"; // ← nouveau

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
            <Route path="/messages" element={<MessagesPage />} />


            {/* Routes protégées - tout utilisateur connecté */}
            <Route element={<ProtectedRoute />}>
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/messages/:partnerId" element={<MessagesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="/dashboard" element={<DashboardRedirect />} />

            {/* Routes acheteur uniquement */}
            <Route element={<RequireBuyer />}>
              <Route path="/rfq" element={<RFQPage />} />
              <Route path="/rfq/:rfqId" element={<RFQPage />} />
              <Route path="/dashboard/buyer" element={<DashboardBuyer />} />
              <Route path="/messages" element={<MessagesPage />} />
              {/* Ajoute ici d'autres routes buyer-only */}
            </Route>

            {/* Routes fournisseur uniquement */}
            <Route element={<RequireSupplier />}>
              <Route path="/dashboard/supplier" element={<DashboardSupplier />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/orders/:id" element={<DashboardSupplier />} />
              <Route path="/dashboard/products/new" element={<NewProductPage />} />
              <Route path="/dashboard/products/edit/:id" element={<EditProductPage />} />
              {/* Ajoute ici d'autres routes supplier-only */}
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<div>404 - Page non trouvée</div>} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;