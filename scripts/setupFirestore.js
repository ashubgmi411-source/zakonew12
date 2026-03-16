/**
 * Zayko 2.0 — Firestore Database Setup Script
 * 
 * Initializes all required Firestore collections with sample documents.
 * Idempotent: safe to run multiple times without duplicating data.
 * 
 * Usage:  node scripts/setupFirestore.js
 */

const admin = require("firebase-admin");
const path = require("path");

// ─── Firebase Admin Initialization ───────────────────────────────────────────
const serviceAccount = require(path.resolve(__dirname, "serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── Seed Data ───────────────────────────────────────────────────────────────

const SEED = {
  // ── Users ──────────────────────────────────────────────────────────────────
  users: {
    docId: "admin_user",
    data: {
      name: "Admin",
      role: "admin",
      email: "admin@zayko.com",
      createdAt: FieldValue.serverTimestamp(),
    },
  },

  // ── Categories ─────────────────────────────────────────────────────────────
  categories: {
    docId: "cat_snacks",
    data: {
      name: "Snacks",
      description: "Light bites and quick eats",
      createdAt: FieldValue.serverTimestamp(),
    },
  },

  // ── Menu Items ─────────────────────────────────────────────────────────────
  menuItems: {
    docId: "item_samosa",
    data: {
      name: "Samosa",
      price: 20,
      category: "snacks",
      available: true,
      createdAt: FieldValue.serverTimestamp(),
    },
  },

  // ── Orders ─────────────────────────────────────────────────────────────────
  orders: {
    docId: "order_sample",
    data: {
      userId: "",
      items: [
        {
          name: "Samosa",
          quantity: 2,
          price: 20,
        },
      ],
      totalAmount: 40,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    },
  },

  // ── Inventory Items ────────────────────────────────────────────────────────
  inventory_items: {
    docId: "inv_potato",
    data: {
      name: "Potato",
      quantity: 100,
      unit: "kg",
      updatedAt: FieldValue.serverTimestamp(),
    },
  },

  // ── Menu → Recipe Mapping ──────────────────────────────────────────────────
  menu_recipe_mapping: {
    docId: "recipe_samosa",
    data: {
      menuItem: "Samosa",
      ingredients: [
        {
          name: "Potato",
          quantity: 0.2,
        },
      ],
    },
  },

  // ── Stock Logs ─────────────────────────────────────────────────────────────
  stock_logs: {
    docId: "log_sample",
    data: {
      item: "Potato",
      change: -2,
      reason: "Order deduction",
      createdAt: FieldValue.serverTimestamp(),
    },
  },

  // ── Feedback ───────────────────────────────────────────────────────────────
  feedback: {
    docId: "feedback_sample",
    data: {
      userId: "",
      rating: 5,
      comment: "Great food and fast service!",
      createdAt: FieldValue.serverTimestamp(),
    },
  },

  // ── Suggestions ────────────────────────────────────────────────────────────
  suggestions: {
    docId: "suggestion_sample",
    data: {
      userId: "",
      suggestion: "Add more South Indian options",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    },
  },
};

// ─── Setup Logic ─────────────────────────────────────────────────────────────

async function setupFirestore() {
  console.log("🚀  Zayko 2.0 — Firestore Setup");
  console.log("─".repeat(50));

  let created = 0;
  let skipped = 0;

  for (const [collection, { docId, data }] of Object.entries(SEED)) {
    const docRef = db.collection(collection).doc(docId);
    const snapshot = await docRef.get();

    if (snapshot.exists) {
      console.log(`⏭  [${collection}] "${docId}" already exists — skipped`);
      skipped++;
    } else {
      await docRef.set(data);
      console.log(`✅  [${collection}] "${docId}" created`);
      created++;
    }
  }

  console.log("─".repeat(50));
  console.log(`🏁  Done!  Created: ${created}  |  Skipped: ${skipped}`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

setupFirestore()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌  Setup failed:", err);
    process.exit(1);
  });
