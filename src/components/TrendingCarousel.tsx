"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { MenuItem } from "@/types";

interface TrendingCarouselProps {
  items: MenuItem[];
}

export default function TrendingCarousel({ items }: TrendingCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [isPaused, setIsPaused] = useState(false);
  const { addItem, items: cartItems } = useCart();

  const trendingItems = items.slice(0, 8);
  const total = trendingItems.length;

  // Auto-advance every 4 seconds
  useEffect(() => {
    if (isPaused || total <= 1) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % total);
    }, 4000);
    return () => clearInterval(timer);
  }, [isPaused, total]);

  const goTo = useCallback(
    (idx: number) => {
      setDirection(idx > currentIndex ? 1 : -1);
      setCurrentIndex(idx);
    },
    [currentIndex]
  );

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  if (total === 0) return null;

  const item = trendingItems[currentIndex];
  const categoryEmoji =
    item.category === "beverages"
      ? "☕"
      : item.category === "snacks"
        ? "🍿"
        : item.category === "meals"
          ? "🍱"
          : item.category === "desserts"
            ? "🍰"
            : "🍽️";

  // Slide animation variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 120 : -120,
      opacity: 0,
      scale: 0.92,
      filter: "blur(6px)",
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -120 : 120,
      opacity: 0,
      scale: 0.92,
      filter: "blur(6px)",
    }),
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* ── Main Carousel Container ── */}
      <div className="px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="trending-carousel-container relative overflow-hidden rounded-[1.5rem]">
          {/* Fixed aspect ratio wrapper — prevents CLS */}
          <div className="relative aspect-[16/9] sm:aspect-[2/1] lg:aspect-[2.5/1] w-full">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`trending-${item.id}-${currentIndex}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 32 },
                  opacity: { duration: 0.35, ease: "easeInOut" },
                  scale: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                  filter: { duration: 0.3 },
                }}
                className="absolute inset-0"
              >
                {/* Image */}
                <div className="relative w-full h-full bg-gradient-to-br from-zayko-800 to-zayko-700">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px"
                      className="object-cover trending-carousel-image"
                      priority={currentIndex === 0}
                      loading={currentIndex === 0 ? "eager" : "lazy"}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl sm:text-7xl opacity-20">
                      {categoryEmoji}
                    </div>
                  )}

                  {/* Cinematic multi-layer gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40" />
                </div>

                {/* ── Content Overlay ── */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8 z-10">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {/* Category badge */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-white/[0.1] backdrop-blur-md border border-white/[0.1] text-white/80 mb-2">
                      <span>{categoryEmoji}</span>
                      <span className="capitalize">{item.category}</span>
                    </span>

                    {/* Name */}
                    <h3 className="font-display font-bold text-xl sm:text-2xl lg:text-3xl text-white leading-tight mb-1 drop-shadow-lg">
                      {item.name}
                    </h3>

                    {/* Description */}
                    {item.description && (
                      <p className="text-xs sm:text-sm text-white/60 line-clamp-2 max-w-md mb-3">
                        {item.description}
                      </p>
                    )}

                    {/* Price + CTA row */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className="price-premium text-xl sm:text-2xl">₹{item.price}</span>

                      {item.available && item.quantity > 0 && (
                        <span className="text-[10px] sm:text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                          {item.quantity <= 3
                            ? `🔥 Only ${item.quantity} left`
                            : `✓ ${item.quantity} available`}
                        </span>
                      )}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* ── Navigation arrows ── */}
            {total > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.1] flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white hover:border-gold-400/30 hover:shadow-[0_0_16px_rgba(251,191,36,0.15)] transition-all duration-300 active:scale-90"
                  aria-label="Previous slide"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.1] flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white hover:border-gold-400/30 hover:shadow-[0_0_16px_rgba(251,191,36,0.15)] transition-all duration-300 active:scale-90"
                  aria-label="Next slide"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* ── Dot Indicators ── */}
          {total > 1 && (
            <div className="absolute bottom-3 sm:bottom-4 right-4 sm:right-6 z-20 flex items-center gap-1.5">
              {trendingItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className="group relative p-0.5"
                >
                  <motion.div
                    className={`rounded-full transition-all duration-300 ${
                      idx === currentIndex
                        ? "w-6 h-2 bg-gradient-to-r from-gold-400 to-gold-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                        : "w-2 h-2 bg-white/30 group-hover:bg-white/50"
                    }`}
                    layout
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* ── Progress bar (auto-advance indicator) ── */}
          {total > 1 && !isPaused && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.05] z-20">
              <motion.div
                key={`progress-${currentIndex}`}
                className="h-full bg-gradient-to-r from-gold-400/60 to-gold-500/80"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 4, ease: "linear" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
