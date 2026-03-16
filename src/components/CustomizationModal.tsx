"use client";
import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { MenuItem, MenuItemOption, SelectedOption } from "@/types";

interface CustomizationModalProps {
    item: MenuItem;
    isOpen: boolean;
    onClose: () => void;
    onAdd: (selectedOptions: SelectedOption[], subtotal: number) => void;
}

export default function CustomizationModal({ item, isOpen, onClose, onAdd }: CustomizationModalProps) {
    const [selections, setSelections] = useState<Record<string, string[]>>({});
    const sheetRef = useRef<HTMLDivElement>(null);

    // Initialize selections with required defaults if single-choice
    useMemo(() => {
        if (!item.customizations) return;
        const initial: Record<string, string[]> = {};
        item.customizations.forEach(cust => {
            if (cust.type === "single" && cust.required && cust.options.length > 0) {
                initial[cust.id] = [cust.options[0].id];
            } else {
                initial[cust.id] = [];
            }
        });
        setSelections(initial);
    }, [item, isOpen]);

    const handleSelect = (customizationId: string, optionId: string, type: "single" | "multiple") => {
        setSelections(prev => {
            const current = prev[customizationId] || [];
            if (type === "single") {
                return { ...prev, [customizationId]: [optionId] };
            } else {
                if (current.includes(optionId)) {
                    return { ...prev, [customizationId]: current.filter(id => id !== optionId) };
                } else {
                    return { ...prev, [customizationId]: [...current, optionId] };
                }
            }
        });
    };

    const isReady = useMemo(() => {
        if (!item.customizations) return true;
        return item.customizations.every(cust => {
            if (!cust.required) return true;
            return selections[cust.id]?.length > 0;
        });
    }, [item, selections]);

    const totalExtra = useMemo(() => {
        if (!item.customizations) return 0;
        let extra = 0;
        item.customizations.forEach(cust => {
            const selectedIds = selections[cust.id] || [];
            selectedIds.forEach(oid => {
                const opt = cust.options.find(o => o.id === oid);
                if (opt) extra += opt.price;
            });
        });
        return extra;
    }, [item, selections]);

    const handleConfirm = () => {
        if (!isReady) return;
        const selectedOptions: SelectedOption[] = [];
        item.customizations?.forEach(cust => {
            const selectedIds = selections[cust.id] || [];
            selectedIds.forEach(oid => {
                const opt = cust.options.find(o => o.id === oid);
                if (opt) {
                    selectedOptions.push({
                        customizationId: cust.id,
                        customizationTitle: cust.title,
                        optionId: opt.id,
                        optionName: opt.name,
                        price: opt.price
                    });
                }
            });
        });
        onAdd(selectedOptions, item.price + totalExtra);
        onClose();
    };

    // Drag-to-dismiss handler
    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        // Close if dragged down >100px or with high velocity
        if (info.offset.y > 100 || info.velocity.y > 500) {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-end justify-center"
                    style={{ touchAction: "none" }}
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        ref={sheetRef}
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 300 }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={handleDragEnd}
                        className="relative w-full max-w-lg bg-zayko-800 border-t border-white/[0.08] rounded-t-3xl overflow-hidden flex flex-col max-h-[85vh]"
                        style={{ touchAction: "none" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ── Drag Handle ── */}
                        <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                        </div>

                        {/* ── Header ── */}
                        <div className="px-5 pb-3 pt-1 border-b border-white/[0.06] flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-display font-bold text-white">{item.name}</h3>
                                <p className="text-xs text-zayko-400 mt-0.5">Customize your order</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-zayko-400 hover:text-white hover:bg-white/[0.1] transition-all active:scale-90"
                            >
                                ✕
                            </button>
                        </div>

                        {/* ── Options List (scrollable) ── */}
                        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6" style={{ touchAction: "pan-y" }}>
                            {item.customizations?.map(cust => (
                                <div key={cust.id} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                            {cust.title}
                                            {cust.required && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">Required</span>}
                                        </h4>
                                        <p className="text-[10px] text-zayko-500">{cust.type === "single" ? "Select one" : "Select multiple"}</p>
                                    </div>

                                    <div className="grid gap-2">
                                        {cust.options.map(opt => {
                                            const isSelected = selections[cust.id]?.includes(opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelect(cust.id, opt.id, cust.type);
                                                    }}
                                                    className={`flex items-center justify-between p-4 min-h-[48px] rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${isSelected
                                                            ? "bg-gold-400/10 border-gold-400/50 text-gold-400"
                                                            : "bg-white/[0.04] border-transparent text-zayko-300 hover:bg-white/[0.08]"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-gold-400 bg-gold-400" : "border-zayko-500"
                                                            }`}>
                                                            {isSelected && <span className="text-zayko-900 text-[10px] font-bold">✓</span>}
                                                        </div>
                                                        <span className="text-sm font-medium">{opt.name}</span>
                                                    </div>
                                                    {opt.price > 0 && <span className="text-xs font-bold">+₹{opt.price}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Footer ── */}
                        <div className="p-5 border-t border-white/[0.06] bg-zayko-800/80 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm text-zayko-400 font-medium">Subtotal</span>
                                <span className="text-xl font-display font-bold text-white">₹{item.price + totalExtra}</span>
                            </div>
                            <motion.button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirm();
                                }}
                                disabled={!isReady}
                                whileTap={{ scale: 0.97 }}
                                className={`w-full py-4 min-h-[52px] rounded-2xl font-bold text-sm transition-all shadow-lg ${isReady
                                        ? "bg-gradient-to-r from-gold-400 to-gold-500 text-zayko-900 hover:shadow-gold-400/20 active:shadow-gold-400/30"
                                        : "bg-zayko-700 text-zayko-500 cursor-not-allowed"
                                    }`}
                            >
                                {isReady ? "Add to Cart 🛒" : "Please select required options"}
                            </motion.button>
                        </div>

                        {/* Safe area for iPhones */}
                        <div className="h-[env(safe-area-inset-bottom)]" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
