/**
 * Admin Settings API — GET + PUT canteen configuration
 * 
 * Stored in Firestore at settings/canteenConfig.
 * Admins can toggle canteen open/close and set operating hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const CONFIG_PATH = "settings/canteenConfig";

const DEFAULT_CONFIG = {
    isOpen: true,
    startTime: "09:00",
    endTime: "17:00",
    nvidiaAsrEnabled: true,
    nvidiaTtsEnabled: true,
    failoverStatus: "active"
};

// GET /api/admin/settings — Fetch current canteen config
export async function GET(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const doc = await adminDb.doc(CONFIG_PATH).get();
        if (!doc.exists) {
            // Initialize with defaults if not set
            await adminDb.doc(CONFIG_PATH).set(DEFAULT_CONFIG);
            return NextResponse.json(DEFAULT_CONFIG);
        }
        const data = doc.data() || {};
        // Merge with defaults to ensure new fields exist
        return NextResponse.json({ ...DEFAULT_CONFIG, ...data });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

// PUT /api/admin/settings — Update canteen config
export async function PUT(req: NextRequest) {
    const admin = verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const data = await req.json();
        const update: Record<string, unknown> = {};

        if (typeof data.isOpen === "boolean") update.isOpen = data.isOpen;
        if (typeof data.nvidiaAsrEnabled === "boolean") update.nvidiaAsrEnabled = data.nvidiaAsrEnabled;
        if (typeof data.nvidiaTtsEnabled === "boolean") update.nvidiaTtsEnabled = data.nvidiaTtsEnabled;

        if (typeof data.startTime === "string" && /^\d{2}:\d{2}$/.test(data.startTime)) {
            update.startTime = data.startTime;
        }

        if (typeof data.endTime === "string" && /^\d{2}:\d{2}$/.test(data.endTime)) {
            update.endTime = data.endTime;
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        update.updatedAt = new Date().toISOString();

        await adminDb.doc(CONFIG_PATH).set(update, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
