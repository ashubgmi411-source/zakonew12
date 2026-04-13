"use client";

import React, { useState, useEffect } from "react";
import { useTheme, THEMES } from "@/context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Check, X } from "lucide-react";

export default function FloatingThemePalette() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme: activeTheme, setTheme } = useTheme();

  // Listen for navbar theme button click
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-theme-panel', handler);
    return () => window.removeEventListener('open-theme-panel', handler);
  }, []);

  return (
    <>
      {/* Floating button — hidden on mobile (navbar has it), visible on desktop */}
      <div className="fixed bottom-[80px] left-4 md:bottom-6 md:left-6 z-40 hidden md:block">
        <button
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-90 hover:scale-105"
          style={{
            background: "var(--btn-primary, #6C63FF)",
            boxShadow: "0 8px 32px var(--accent-glow, rgba(0,0,0,0.3))",
            color: "#FFF",
          }}
        >
          <Palette className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 md:left-auto md:right-6 md:bottom-28 md:w-80 rounded-t-3xl md:rounded-3xl z-[70] p-6 shadow-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>Themes</h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Choose your vibe</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-black/10"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                {THEMES.map((t) => {
                  const isActive = activeTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className="w-full text-left p-3 rounded-2xl flex items-center gap-4 transition-all relative overflow-hidden group"
                      style={{
                        background: isActive ? "var(--bg-secondary)" : t.colors.secondary,
                        border: isActive 
                          ? "2px solid var(--accent)" 
                          : `1px solid ${t.colors.primary}`,
                        boxShadow: isActive ? "0 4px 20px var(--accent-glow)" : "0 2px 8px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner"
                        style={{ background: t.colors.primary }}
                      >
                        {t.icon}
                      </div>
                      
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: isActive ? "var(--text-primary)" : "#FFF", mixBlendMode: "difference" }}>
                          {t.name}
                        </p>
                        <p className="text-[11px] opacity-70" style={{ color: isActive ? "var(--text-secondary)" : "#FFF", mixBlendMode: "difference" }}>
                          {t.description}
                        </p>
                      </div>

                      {isActive && (
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                          style={{ background: "var(--accent)", color: "#FFF" }}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
