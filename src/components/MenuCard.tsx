"use client";
import React, { useState, useRef, useCallback } from "react";
import { useCart } from "@/context/CartContext";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

import { MenuItem, SelectedOption } from "@/types";
import CustomizationModal from "./CustomizationModal";

export default function MenuCard({ id, name, price, category, available, quantity, preparationTime, image, description, customizations }: MenuItem & { id: string }) {
    const { addItem, items } = useCart();
    const cartItem = items.find((i) => i.id === id);
    const inCart = cartItem ? cartItem.quantity : 0;
    const [flyAnim, setFlyAnim] = useState(false);
    const [showCustomization, setShowCustomization] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });

    // 3D tilt handler
    const handleTilt = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        let clientX: number, clientY: number;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        const tiltX = (y - 0.5) * -6;
        const tiltY = (x - 0.5) * 6;
        setTilt({ x: tiltX, y: tiltY });
    }, []);

    const resetTilt = useCallback(() => {
        setTilt({ x: 0, y: 0 });
    }, []);

    const handleAdd = () => {
        if (!available || (quantity <= 0 && available)) {
            toast.error("This item is currently out of stock");
            return;
        }

        if (customizations && customizations.length > 0) {
            setShowCustomization(true);
            return;
        }

        if (inCart >= quantity) {
            toast.error("Maximum available quantity reached");
            return;
        }

        executeAdd();
    };

    const executeAdd = (selectedOptions?: SelectedOption[], finalPrice?: number) => {
        addItem({
            id,
            name,
            price: finalPrice || price,
            maxQuantity: quantity,
            category,
            image,
            selectedOptions
        });
        setFlyAnim(true);
        setShowSuccess(true);
        setTimeout(() => setFlyAnim(false), 500);
        setTimeout(() => setShowSuccess(false), 1200);
        toast.success(`${name} added to cart!`, {
            style: {
                background: "rgba(10, 22, 40, 0.95)",
                color: "#f1f5f9",
                border: "1px solid rgba(251,191,36,0.2)",
                backdropFilter: "blur(20px)",
                borderRadius: "1rem",
                fontSize: "0.875rem",
            },
            iconTheme: { primary: "#fbbf24", secondary: "#050b14" },
            duration: 1500,
        });
    };

    const categoryEmoji = category === "beverages" ? "☕" : category === "snacks" ? "🍿" : category === "meals" ? "🍱" : category === "desserts" ? "🍰" : "🍽️";
    const isOutOfStock = !available || quantity <= 0;

    return (
        <>
            <motion.div
                ref={cardRef}
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
                onTouchMove={handleTilt}
                onTouchEnd={resetTilt}
                onClick={(e) => {
                    // Only fire card-level click if NOT clicking a button or its children
                    const target = e.target as HTMLElement;
                    if (target.closest("button")) return;
                    if (isOutOfStock) toast.error("Item currently unavailable");
                }}
                style={{
                    transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                    transition: 'transform 0.2s ease-out',
                    willChange: 'transform',
                }}
                className={`flex flex-col food-card-premium cursor-pointer group overflow-hidden ${isOutOfStock ? "opacity-50 grayscale-[0.3]" : ""}`}
                whileHover={{ y: -6, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
            >
                {/* ── Image Section ── */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-zayko-800 to-zayko-700 overflow-hidden">
                    {image ? (
                        <img
                            src={image}
                            alt={name}
                            className="w-full h-full object-cover food-card-image"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl opacity-30 food-card-image">
                            {categoryEmoji}
                        </div>
                    )}

                    {/* Cinematic gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/30" />

                    {/* Price badge — floating glass */}
                    <div className="absolute top-2.5 right-2.5">
                        <span className="price-premium text-sm sm:text-base px-2.5 py-1 rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.08]">
                            ₹{price}
                        </span>
                    </div>

                    {/* Sold out overlay */}
                    <AnimatePresence>
                        {isOutOfStock && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-[3px] flex items-center justify-center"
                            >
                                <motion.span
                                    initial={{ scale: 0.8, rotate: -5 }}
                                    animate={{ scale: 1, rotate: -3 }}
                                    className="bg-red-500/90 text-white px-5 py-2 rounded-2xl font-bold text-xs tracking-wider uppercase shadow-2xl shadow-red-500/30"
                                >
                                    Sold Out
                                </motion.span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Add-to-cart success checkmark overlay */}
                    <AnimatePresence>
                        {showSuccess && !isOutOfStock && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                    className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl shadow-xl shadow-emerald-500/40"
                                >
                                    ✓
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Content ── */}
                <div className="flex flex-col flex-1 p-3 sm:p-4 gap-2">
                    {/* Name */}
                    <h3 className="font-display font-bold text-sm sm:text-[15px] text-white line-clamp-1 leading-tight group-hover:text-gold-300 transition-colors duration-300">
                        {name}
                    </h3>

                    {/* Description */}
                    {description && (
                        <p className="hidden sm:block text-xs text-zayko-400 line-clamp-2 leading-relaxed">{description}</p>
                    )}

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                        {!isOutOfStock ? (
                            <>
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border ${quantity <= 3
                                        ? "bg-amber-500/15 text-amber-400 border-amber-500/20 low-stock-pulse"
                                        : quantity <= 5
                                            ? "bg-amber-500/10 text-amber-300 border-amber-500/15"
                                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        }`}
                                >
                                    {quantity <= 3 ? <><span className="flame-icon">🔥</span> {quantity} left</> : quantity <= 5 ? `⚠️ ${quantity} left` : `✓ ${quantity}`}
                                </span>
                                {customizations && customizations.length > 0 && (
                                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                        ✨ Custom
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                                ✗ Unavailable
                            </span>
                        )}
                    </div>

                    {/* ── Premium Add Button ── */}
                    <motion.button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAdd();
                        }}
                        disabled={isOutOfStock}
                        whileTap={{ scale: 0.94 }}
                        className={`w-full flex items-center justify-center gap-1.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${!isOutOfStock
                                ? "btn-add-premium"
                                : "bg-zayko-700/50 text-zayko-500 cursor-not-allowed"
                            }`}
                    >
                        <AnimatePresence mode="wait">
                            {flyAnim ? (
                                <motion.span
                                    key="fly"
                                    initial={{ y: 0 }}
                                    animate={{ y: -12, opacity: 0 }}
                                    exit={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    🛒
                                </motion.span>
                            ) : inCart > 0 ? (
                                <motion.span
                                    key="in-cart"
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    className="flex items-center gap-1"
                                >
                                    <span className="bg-zayko-900/20 px-1.5 py-0.5 rounded-md text-[10px]">{inCart}</span>
                                    <span>in cart · Add +</span>
                                </motion.span>
                            ) : (
                                <motion.span
                                    key="add"
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    className="flex items-center gap-1.5"
                                >
                                    Add to Cart
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </div>
            </motion.div>

            <CustomizationModal
                item={{ id, name, price, category, available, quantity, preparationTime, image, description, customizations } as MenuItem}
                isOpen={showCustomization}
                onClose={() => setShowCustomization(false)}
                onAdd={executeAdd}
            />
        </>
    );
}
