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
    const [morphAnim, setMorphAnim] = useState(false);
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
        const tiltX = (y - 0.5) * -8;
        const tiltY = (x - 0.5) * 8;
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
        setMorphAnim(true);
        setTimeout(() => setFlyAnim(false), 400);
        setTimeout(() => setMorphAnim(false), 400);
        toast.success(`${name} added to cart! 🛒`, {
            style: {
                background: "#0a1628",
                color: "#e2e8f0",
                border: "1px solid rgba(251,191,36,0.2)",
            },
            iconTheme: { primary: "#fbbf24", secondary: "#050b14" },
        });
    };

    const categoryEmoji = category === "beverages" ? "☕" : category === "snacks" ? "🍿" : category === "meals" ? "🍱" : category === "desserts" ? "🍰" : "🍽️";

    return (
        <>
            <div
                ref={cardRef}
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
                onTouchMove={handleTilt}
                onTouchEnd={resetTilt}
                onClick={() => !available && toast.error("Item currently unavailable")}
                style={{
                    transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.03 : 1})`,
                    transition: 'transform 0.15s ease-out',
                    willChange: 'transform',
                }}
                className={`flex flex-col bg-zayko-800/60 border border-white/[0.06] rounded-2xl overflow-hidden group cursor-pointer hover:border-gold-400/20 hover:shadow-[0_8px_30px_rgba(251,191,36,0.08)] ${!available ? "opacity-60 grayscale-[0.3]" : ""}`}
            >
                {/* Image Section — fixed aspect ratio */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-zayko-800 to-zayko-700 overflow-hidden">
                    {image ? (
                        <img src={image} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl opacity-40 group-hover:scale-110 transition-transform duration-500">
                            {categoryEmoji}
                        </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    {/* Price badge */}
                    <span className="absolute top-2 right-2 px-2.5 py-1 rounded-xl text-xs sm:text-sm font-bold text-gold-400 bg-zayko-900/80 backdrop-blur-sm border border-gold-400/20 shadow-lg shadow-black/20">
                        ₹{price}
                    </span>

                    {/* Sold out overlay */}
                    <AnimatePresence>
                        {(!available || quantity <= 0) && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center"
                            >
                                <span className="bg-red-500/90 text-white px-4 py-1.5 rounded-xl font-bold text-xs rotate-[-3deg] shadow-lg">
                                    SOLD OUT
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-3 sm:p-4 gap-2">
                    {/* Name */}
                    <h3 className="font-display font-bold text-sm sm:text-[15px] text-white line-clamp-1 leading-tight">
                        {name}
                    </h3>

                    {/* Description — hide on very small mobile for compact cards */}
                    {description && (
                        <p className="hidden sm:block text-xs text-zayko-400 line-clamp-2 leading-relaxed">{description}</p>
                    )}

                    {/* Badge */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                        {available && quantity > 0 ? (
                            <>
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border ${quantity <= 3
                                        ? "bg-amber-500/15 text-amber-400 border-amber-500/20 low-stock-pulse"
                                        : quantity <= 5
                                            ? "bg-amber-500/10 text-amber-300 border-amber-500/15"
                                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        }`}
                                >
                                    {quantity <= 3 ? `🔥 ${quantity} left` : quantity <= 5 ? `⚠️ ${quantity} left` : `✓ ${quantity}`}
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

                    {/* Add Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAdd();
                        }}
                        disabled={!available || quantity <= 0}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${morphAnim ? 'morph-add' : ''} ${available && quantity > 0
                            ? "bg-gradient-to-r from-gold-400 to-gold-500 text-zayko-900 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] active:scale-[0.95]"
                            : "bg-zayko-700 text-zayko-500 cursor-not-allowed"
                            }`}
                    >
                        <span className={flyAnim ? "cart-fly" : ""}>
                            {inCart > 0 ? (
                                <>In Cart ({inCart}) +</>
                            ) : (
                                <>Add 🛒</>
                            )}
                        </span>
                    </button>
                </div>
            </div>

            <CustomizationModal
                item={{ id, name, price, category, available, quantity, preparationTime, image, description, customizations } as MenuItem}
                isOpen={showCustomization}
                onClose={() => setShowCustomization(false)}
                onAdd={executeAdd}
            />
        </>
    );
}
