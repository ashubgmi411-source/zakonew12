"use client";
import React from "react";
import { motion } from "framer-motion";

const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
};

const pageTransition = {
    duration: 0.25,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
};

export default function PageTransition({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={pageTransition}
        >
            {children}
        </motion.div>
    );
}
