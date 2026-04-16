"use client";
import React from "react";
import { useCart } from "@/context/CartContext";
import ScheduledOrderModal from "@/components/ScheduledOrderModal";

/**
 * GlobalModals — Container for modals that need to be accessible app-wide.
 * This is a Client Component to avoid "useCart() on server" errors in layout.tsx.
 */
export default function GlobalModals() {
    const { isScheduleModalOpen, setIsScheduleModalOpen } = useCart();

    return (
        <ScheduledOrderModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
        />
    );
}
