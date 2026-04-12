"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const letters = ["Z", "A", "Y", "K", "O"];

export default function IntroScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 1500);
    const t3 = setTimeout(() => setPhase(3), 2500);
    const t4 = setTimeout(() => onComplete(), 3800);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center"
      animate={phase === 3 ? { opacity: 0, scale: 1.05 } : { opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Z Icon */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="text-8xl font-black mb-4"
            style={{
              background: "linear-gradient(135deg, #FF6B35, #00D4FF)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px #FF6B3580)"
            }}
          >
            Z
          </motion.div>
        )}
      </AnimatePresence>

      {/* Letter by letter ZAYKO */}
      {phase >= 2 && (
        <div className="flex gap-1">
          {letters.map((letter, i) => (
            <motion.span
              key={letter}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="text-5xl font-black text-white tracking-widest"
            >
              {letter}
            </motion.span>
          ))}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-bold ml-2 self-end mb-2"
            style={{ color: "#00D4FF" }}
          >
            2.O
          </motion.span>
        </div>
      )}

      {/* Tagline */}
      {phase >= 2 && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-gray-400 text-sm tracking-[0.3em] mt-3 uppercase"
        >
          AI Canteen. Reimagined.
        </motion.p>
      )}
    </motion.div>
  );
}
