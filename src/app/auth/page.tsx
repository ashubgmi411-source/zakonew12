"use client";
import React, { useState, useEffect } from "react";
import {
    auth,
    GoogleAuthProvider,
    signInWithPopup,
} from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Step = "login" | "profile";

export default function AuthPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<Step>("login");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            const checkProfile = async () => {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const redirectUrl = new URLSearchParams(window.location.search).get("redirect") || "/";
                    router.push(redirectUrl);
                } else {
                    setStep("profile");
                }
            };
            checkProfile();
        }
    }, [user, loading, router]);

    const handleGoogleSignIn = async () => {
        setError("");
        setSending(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const uid = result.user.uid;

            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const redirectUrl = new URLSearchParams(window.location.search).get("redirect") || "/";
                router.push(redirectUrl);
            } else {
                setStep("profile");
            }
        } catch (err) {
            if (err instanceof Error && err.message.includes("popup-closed")) {
                setError("");
            } else {
                setError(err instanceof Error ? err.message : "Failed to sign in with Google");
            }
        }
        setSending(false);
    };

    const saveProfile = async () => {
        setError("");
        if (!name.trim() || phone.length !== 10) {
            setError("Please fill Name and 10-digit Phone");
            return;
        }

        setSending(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Not authenticated");

            const token = await currentUser.getIdToken();
            const res = await fetch("/api/users/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: name.trim(),
                    phone,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save profile");

            const redirectUrl = new URLSearchParams(window.location.search).get("redirect") || "/";
            router.push(redirectUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save profile");
        }
        setSending(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zayko-500 via-zayko-600 to-zayko-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8 animate-fade-in">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl">
                        ⚡
                    </div>
                    <h1 className="text-3xl font-display font-bold text-white">Zayko</h1>
                    <p className="text-zayko-200 mt-1">Order Smart. Eat Fresh.</p>
                </div>

                <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 animate-slide-up">
                    {step === "login" && (
                        <>
                            <h2 className="text-xl font-display font-bold text-zayko-700 mb-1">Welcome! 👋</h2>
                            <p className="text-gray-500 text-sm mb-6">Sign in with your Google account to get started</p>

                            <div className="space-y-4">
                                <button
                                    onClick={handleGoogleSignIn}
                                    disabled={sending}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                                >
                                    {sending ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-zayko-500 border-t-transparent rounded-full animate-spin"></div>
                                            Signing in...
                                        </div>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                            Sign in with Google
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {step === "profile" && (
                        <>
                            <h2 className="text-xl font-display font-bold text-zayko-700 mb-1">Create Account 📝</h2>
                            <p className="text-gray-500 text-sm mb-6">Complete your profile to order food</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter your full name"
                                        className="input-field"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Mobile Number</label>
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                        placeholder="Enter 10-digit mobile number"
                                        className="input-field font-mono tracking-widest text-center"
                                    />
                                </div>

                                <button
                                    onClick={saveProfile}
                                    disabled={sending || !name.trim() || phone.length !== 10}
                                    className="btn-primary w-full mt-2"
                                >
                                    {sending ? "Creating Account..." : "Complete Registration 🚀"}
                                </button>
                            </div>
                        </>
                    )}


                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-scale-in">
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                <p className="text-center text-zayko-300 text-xs mt-6">
                    Secured with Firebase Authentication
                </p>
            </div>
        </div>
    );
}
