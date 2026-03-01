"use client";
import React from "react";
import { motion } from "framer-motion";

interface AnimatedTextProps {
    text: string;
    className?: string;
    delay?: number;
    staggerMs?: number;
}

export default function AnimatedText({
    text,
    className = "",
    delay = 0,
    staggerMs = 40,
}: AnimatedTextProps) {
    const letters = text.split("");

    const containerVariants = {
        hidden: {},
        visible: {
            transition: {
                delayChildren: delay,
                staggerChildren: staggerMs / 1000,
            },
        },
    };

    const letterVariants = {
        hidden: {
            opacity: 0,
            y: 20,
            rotateX: 40,
            filter: "blur(4px)",
        },
        visible: {
            opacity: 1,
            y: 0,
            rotateX: 0,
            filter: "blur(0px)",
            transition: {
                duration: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94] as const,
            },
        },
    };

    return (
        <motion.span
            className={`inline-flex flex-wrap justify-center ${className}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ perspective: "600px" }}
        >
            {letters.map((letter, i) => (
                <motion.span
                    key={`${letter}-${i}`}
                    variants={letterVariants}
                    className="inline-block"
                    style={{
                        transformStyle: "preserve-3d",
                        whiteSpace: letter === " " ? "pre" : undefined,
                    }}
                >
                    {letter === " " ? "\u00A0" : letter}
                </motion.span>
            ))}
        </motion.span>
    );
}
