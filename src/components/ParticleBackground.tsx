"use client";
import React, { useState, useEffect } from "react";

interface Particle {
    id: number;
    size: number;
    x: number;
    y: number;
    duration: number;
    delay: number;
    opacity: number;
    color: string;
}

export default function ParticleBackground() {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        const colors = [
            "rgba(251, 191, 36, 0.3)",
            "rgba(251, 191, 36, 0.2)",
            "rgba(96, 165, 250, 0.2)",
            "rgba(96, 165, 250, 0.15)",
            "rgba(253, 230, 138, 0.25)",
        ];
        setParticles(
            Array.from({ length: 30 }, (_, i) => ({
                id: i,
                size: 2 + Math.random() * 4,
                x: Math.random() * 100,
                y: Math.random() * 100,
                duration: 8 + Math.random() * 12,
                delay: Math.random() * 5,
                opacity: 0.15 + Math.random() * 0.25,
                color: colors[Math.floor(Math.random() * colors.length)],
            }))
        );
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="intro-particle"
                    style={{
                        width: p.size,
                        height: p.size,
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        background: p.color,
                        opacity: p.opacity,
                        animationDuration: `${p.duration}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
        </div>
    );
}
