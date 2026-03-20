import React from "react";
import "@/index.css";
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
  DashboardPage
} from "./pages";

import MessagesPage from "./pages/MessagesPage";
import NotificationsPage from "./pages/NotificationsPage";
import RFQPage from "./pages/RFQPage";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/categories" element={<ProductsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/success" element={<CheckoutPage />} />
            <Route path="/checkout/cancel" element={<CheckoutPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/*" element={<DashboardPage />} />
            <Route path="/favorites" element={<DashboardPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:partnerId" element={<MessagesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/rfq" element={<RFQPage />} />
            <Route path="/rfq/:rfqId" element={<RFQPage />} />
            <Route path="/orders/:id" element={<DashboardPage />} />
            <Route path="/suppliers" element={<ProductsPage />} />
            <Route path="/blog" element={<HomePage />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
