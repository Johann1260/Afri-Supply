import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartAPI } from '../lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cart, setCart]     = useState({ items: [], total: 0, item_count: 0 });
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart({ items: [], total: 0, item_count: 0 });
      return;
    }
    try {
      setLoading(true);
      const res = await cartAPI.get();
      setCart(res.data);
    } catch (err) {
      console.error('fetchCart error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addToCart = async (productId, quantity = 1) => {
    try {
      setLoading(true);
      const res = await cartAPI.addItem(productId, quantity);
      setCart(res.data);
      return true;
    } catch (err) {
      console.error('addToCart error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId, quantity) => {
    try {
      setLoading(true);
      const res = await cartAPI.updateItem(productId, quantity);
      setCart(res.data);
    } catch (err) {
      console.error('updateQuantity error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (productId) => {
    try {
      setLoading(true);
      const res = await cartAPI.removeItem(productId);
      setCart(res.data);
    } catch (err) {
      console.error('removeFromCart error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    try {
      setLoading(true);
      await cartAPI.clear();
      setCart({ items: [], total: 0, item_count: 0 });
    } catch (err) {
      console.error('clearCart error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <CartContext.Provider value={{
      cart, loading,
      addToCart, updateQuantity, removeFromCart, clearCart,
      refreshCart: fetchCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};