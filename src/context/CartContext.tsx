/**
 * CartContext — Shopping cart state management
 * 
 * UX FIX: Cart is now persisted to localStorage so items survive page refreshes.
 */

"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

import { CartItem, SelectedOption } from "@/types";

interface CartContextType {
    items: CartItem[];
    addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
    removeItem: (id: string, selectedOptions?: SelectedOption[]) => void;
    updateQuantity: (id: string, quantity: number, selectedOptions?: SelectedOption[]) => void;
    clearCart: () => void;
    total: number;
    itemCount: number;
    isCartOpen: boolean;
    setIsCartOpen: (open: boolean) => void;
    isScheduleModalOpen: boolean;
    setIsScheduleModalOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType>({
    items: [],
    addItem: () => { },
    removeItem: () => { },
    updateQuantity: () => { },
    clearCart: () => { },
    total: 0,
    itemCount: 0,
    isCartOpen: false,
    setIsCartOpen: () => { },
    isScheduleModalOpen: false,
    setIsScheduleModalOpen: () => { },
});


const CART_STORAGE_KEY = "canteen_cart";

export function CartProvider({ children }: { children: ReactNode }) {
    // UX FIX: Initialize cart from localStorage to survive page refreshes
    const [items, setItems] = useState<CartItem[]>(() => {
        if (typeof window === "undefined") return [];
        try {
            const saved = localStorage.getItem(CART_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Global Drawer + Modal State
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    // UX FIX: Persist cart to localStorage on every change
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        } catch {
            // localStorage might be full or unavailable — silently ignore
        }
    }, [items]);

    const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
        setItems((prev) => {
            const existing = prev.find((i) =>
                i.id === item.id &&
                JSON.stringify(i.selectedOptions) === JSON.stringify(item.selectedOptions)
            );
            if (existing) {
                if (existing.quantity >= existing.maxQuantity) return prev;
                return prev.map((i) => (
                    i.id === item.id &&
                        JSON.stringify(i.selectedOptions) === JSON.stringify(item.selectedOptions)
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                ));
            }
            return [...prev, { ...item, quantity: item.quantity || 1 }];
        });
    }, []);

    const removeItem = useCallback((id: string, selectedOptions?: SelectedOption[]) => {
        setItems((prev) => prev.filter((i) =>
            !(i.id === id && JSON.stringify(i.selectedOptions) === JSON.stringify(selectedOptions))
        ));
    }, []);

    const updateQuantity = useCallback((id: string, quantity: number, selectedOptions?: SelectedOption[]) => {
        if (quantity <= 0) {
            removeItem(id, selectedOptions);
        } else {
            setItems((prev) => prev.map((i) => (
                i.id === id && JSON.stringify(i.selectedOptions) === JSON.stringify(selectedOptions)
                    ? { ...i, quantity: Math.min(quantity, i.maxQuantity) }
                    : i
            )));
        }
    }, [removeItem]);

    const clearCart = useCallback(() => {
        setItems([]);
        try {
            localStorage.removeItem(CART_STORAGE_KEY);
        } catch {
            // Silently ignore
        }
    }, []);

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{ 
            items, addItem, removeItem, updateQuantity, clearCart, total, itemCount, 
            isCartOpen, setIsCartOpen,
            isScheduleModalOpen, setIsScheduleModalOpen
        }}>
            {children}
        </CartContext.Provider>
    );
}


export const useCart = () => useContext(CartContext);
