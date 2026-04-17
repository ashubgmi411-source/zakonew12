"use client";
import React from "react";
import AdminGuard from "@/components/AdminGuard";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminZiva from "@/components/admin/AdminZiva";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // If we're on the main admin login page, don't wrap in AdminGuard or show Header
    if (pathname === "/admin") {
        return <>{children}</>;
    }

    return (
        <AdminGuard>
            <div className="min-h-screen transition-colors duration-300">
                <AdminHeader />
                <main className="animate-fade-in">
                    {children}
                </main>
                {/* Global Admin AI Assistant */}
                <AdminZiva />
            </div>
        </AdminGuard>
    );
}
