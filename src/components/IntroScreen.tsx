"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ParticleBackground from "./ParticleBackground";
import AnimatedText from "./AnimatedText";

interface IntroScreenProps {
    onComplete: () => void;
}

const FLOATING_WORDS = ["Fast", "Fresh", "Smart", "AI Powered"];

export default function IntroScreen({ onComplete }: IntroScreenProps) {
    const [phase, setPhase] = useState(0); // 0=mount, 1=zayko, 2=madeby, 3=author, 4=exit

    useEffect(() => {
        // Phase timeline
        const timers = [
            setTimeout(() => setPhase(1), 200),     // Show ZAYKO
            setTimeout(() => setPhase(2), 1200),     // Show "Made by"
            setTimeout(() => setPhase(3), 1800),     // Show author name
            setTimeout(() => setPhase(4), 3200),     // Begin exit
            setTimeout(() => onComplete(), 3800),    // Unmount
        ];
        return () => timers.forEach(clearTimeout);
    }, [onComplete]);

    return (
        <AnimatePresence>
            {phase < 5 && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex items-center justify-center intro-bg overflow-hidden"
                    initial={{ opacity: 1 }}
                    animate={phase >= 4 ? { opacity: 0, scale: 1.02 } : { opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                >
                    {/* Particles */}
                    <ParticleBackground />

                    {/* Center spotlight */}
                    <div className="intro-spotlight" />

                    {/* Floating buzzwords */}
                    {FLOATING_WORDS.map((word, i) => (
                        <div
                            key={word}
                            className="floating-word"
                            style={{
                                top: `${15 + i * 20}%`,
                                left: `${10 + (i % 2 === 0 ? 5 : 60)}%`,
                                animationDelay: `${i * 1.5}s`,
                                animationDuration: `${12 + i * 3}s`,
                            }}
                        >
                            {word}
                        </div>
                    ))}

                    {/* Text container with perspective for 3D depth */}
                    <div
                        className="relative z-10 text-center px-6"
                        style={{ perspective: "1000px" }}
                    >
                        {/* ZAYKO */}
                        <AnimatePresence>
                            {phase >= 1 && (
                                <motion.h1
                                    className="text-3d-metallic font-display text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-wider mb-4 select-none"
                                    initial={{
                                        opacity: 0,
                                        scale: 0.8,
                                        rotateY: 8,
                                        filter: "blur(8px)",
                                    }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        rotateY: 0,
                                        filter: "blur(0px)",
                                    }}
                                    transition={{
                                        duration: 0.8,
                                        ease: [0.25, 0.46, 0.45, 0.94],
                                    }}
                                    style={{ transformStyle: "preserve-3d" }}
                                >
                                    ZAYKO
                                </motion.h1>
                            )}
                        </AnimatePresence>

                        {/* Made by */}
                        <AnimatePresence>
                            {phase >= 2 && (
                                <motion.p
                                    className="text-white/50 text-sm sm:text-base font-light tracking-[0.3em] uppercase mb-3"
                                    initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                    transition={{
                                        duration: 0.5,
                                        ease: [0.25, 0.46, 0.45, 0.94],
                                    }}
                                >
                                    Made by
                                </motion.p>
                            )}
                        </AnimatePresence>

                        {/* Author name */}
                        <AnimatePresence>
                            {phase >= 3 && (
                                <motion.div
                                    className="relative inline-block"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="text-3d-embossed font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide">
                                        <AnimatedText
                                            text="Shudhanshu Pandey"
                                            delay={0.1}
                                            staggerMs={45}
                                        />
                                    </div>
                                    {/* Light sweep overlay */}
                                    <div className="light-sweep" />
                                    {/* Glow underline */}
                                    <motion.div
                                        className="glow-underline"
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{
                                            duration: 0.8,
                                            delay: 0.6,
                                            ease: [0.25, 0.46, 0.45, 0.94],
                                        }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
