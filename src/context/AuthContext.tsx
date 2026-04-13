/**
 * AuthContext — User authentication state management
 * 
 * SECURITY/UX CHANGES:
 * - Profile uses onSnapshot for REAL-TIME updates (wallet balance, etc.)
 * - Exposes getIdToken() for API calls that need Firebase ID tokens
 * - No more stale wallet balance after orders
 */

"use client";
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { auth, db } from "@/lib/firebase";
import {
    onAuthStateChanged,
    onIdTokenChanged,
    User,
    signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

interface UserProfile {
    uid: string;
    email: string;
    name: string;
    phone: string;
    rollNumber: string;
    pinHash?: string; // Add this
    walletBalance: number;
    uniqueCode: string;
    gender?: "male" | "female" | string;
    role: "user" | "admin" | "stock_manager";
    createdAt: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    isPinVerified: boolean; // Session-based PIN lock
    setPinVerified: (v: boolean) => void;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    isPinVerified: false,
    setPinVerified: () => { },
    signOut: async () => { },
    refreshProfile: async () => { },
    getIdToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPinVerified, setPinVerified] = useState(false);

    // Real-time profile listener
    useEffect(() => {
        if (!user) {
            setProfile(null);
            setPinVerified(false); // Reset on logout
            return;
        }

        const unsubscribe = onSnapshot(
            doc(db, "users", user.uid),
            (docSnap) => {
                if (docSnap.exists()) {
                    setProfile(docSnap.data() as UserProfile);
                } else {
                    setProfile(null);
                }
            },
            (error) => {
                console.error("Profile listener error:", error);
            }
        );

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                const token = await firebaseUser.getIdToken();
                document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Strict`;
            } else {
                document.cookie = `auth-token=; path=/; max-age=0; SameSite=Strict`;
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signOut = async () => {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        setPinVerified(false);
    };

    const getIdToken = useCallback(async (): Promise<string | null> => {
        if (!user) return null;
        try {
            return await user.getIdToken();
        } catch {
            return null;
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, profile, loading, isPinVerified, setPinVerified, signOut, refreshProfile: async () => { }, getIdToken }}>
            {children}
            {/* Global PIN Lock Screen Overlay */}
            {user && profile && profile.pinHash && !isPinVerified && (
                <PinLockScreen />
            )}
        </AuthContext.Provider>
    );
}

// ─── PIN Lock Screen Component ─────────────────────────────────────
function PinLockScreen() {
    const { user, profile, setPinVerified, signOut, getIdToken } = useAuth();
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [verifying, setVerifying] = useState(false);

    const handleVerifyPin = async () => {
        if (pin.length !== 4) return;
        setVerifying(true);
        setError("");
        try {
            const token = await getIdToken();
            const res = await fetch("/api/users/verify-pin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ pin })
            });

            if (res.ok) {
                setPinVerified(true);
            } else {
                const data = await res.json();
                setError(data.error || "Incorrect PIN");
                setPin("");
            }
        } catch (err) {
            setError("Connection error");
        } finally {
            setVerifying(false);
        }
    };

    useEffect(() => {
        if (pin.length === 4) handleVerifyPin();
    }, [pin]);

    return (
        <div className="fixed inset-0 z-[9999] bg-zayko-900 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-sm text-center">
                <div className="w-20 h-20 bg-gold-400/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-3xl border border-gold-400/20 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
                    🔐
                </div>

                <h2 className="text-2xl font-display font-bold text-white mb-2">Welcome Back!</h2>
                <p className="text-zayko-400 text-sm mb-8">Hello, {profile?.email}<br />Please enter your 4-digit PIN to continue.</p>

                <div className="relative mb-8">
                    <input
                        type="password"
                        autoFocus
                        maxLength={4}
                        value={pin}
                        disabled={verifying}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-zayko-800 border-2 border-zayko-700 text-white text-center text-4xl font-mono tracking-[1em] py-5 rounded-3xl focus:border-gold-400 focus:outline-none transition-all shadow-inner"
                        placeholder="●●●●"
                    />

                    {verifying && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>

                {error && <p className="text-red-400 text-sm mb-6 animate-shake">❌ {error}</p>}

                <div className="flex flex-col gap-4">
                    <button
                        onClick={signOut}
                        className="text-zayko-500 hover:text-red-400 text-sm font-bold transition-colors"
                    >
                        Sign Out & Switch Account
                    </button>
                    <p className="text-[10px] text-zayko-600 uppercase tracking-widest font-bold">Encrypted with BCrypt</p>
                </div>
            </div>
        </div>
    );
}

export const useAuth = () => useContext(AuthContext);
