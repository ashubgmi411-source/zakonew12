"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import MenuCard from "@/components/MenuCard";
import TrendingCarousel from "@/components/TrendingCarousel";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import JarvisChat from "@/components/JarvisChat";
import ScheduledOrderModal from "@/components/ScheduledOrderModal";
import { Search, Wallet, Utensils, X, Salad } from "lucide-react";
import { 
  GiPizzaSlice, GiHamburger, GiCoffeeCup, GiMeal, 
  GiSandwich, GiCupcake, GiTacos, GiNoodles, GiIceCreamCone, 
  GiTeapot, GiWaterBottle, GiFrenchFries, GiDumpling, GiBread
} from "react-icons/gi";

import { MenuItem, CategoryDoc } from "@/types";

interface CanteenConfig {
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

export default function MenuPage() {
  const { user, profile, loading } = useAuth();
  const { itemCount, total, setIsCartOpen } = useCart();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [menuLoading, setMenuLoading] = useState(true);
  const [showUnavailable, setShowUnavailable] = useState(true);
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [cartPulse, setCartPulse] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  // Real-time Firestore subscription for menu
  useEffect(() => {
    const q = query(collection(db, "menuItems"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MenuItem[];
      setMenuItems(items);
      setMenuLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time canteen config subscription
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "canteenConfig"), (snap) => {
      if (snap.exists()) {
        setCanteenConfig(snap.data() as CanteenConfig);
      }
    });
    return () => unsub();
  }, []);

  // Real-time categories subscription
  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CategoryDoc[]);
    });
    return () => unsub();
  }, []);

  // Cart pulse effect
  useEffect(() => {
    if (itemCount > 0) {
      setCartPulse(true);
      const t = setTimeout(() => setCartPulse(false), 1500);
      return () => clearTimeout(t);
    }
  }, [itemCount]);

  // Compute minutes until canteen closes
  const getMinutesUntilClose = (): number | null => {
    if (!canteenConfig?.endTime) return null;
    const now = new Date();
    const [h, m] = canteenConfig.endTime.split(":").map(Number);
    const closeTime = new Date();
    closeTime.setHours(h, m, 0, 0);
    const diff = (closeTime.getTime() - now.getTime()) / 60000;
    return Math.max(0, Math.round(diff));
  };

  const minutesUntilClose = getMinutesUntilClose();
  const isCanteenOpen = canteenConfig?.isOpen !== false;

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || item.category === category;
    const canPrepare = !item.preparationTime
      || minutesUntilClose === null
      || minutesUntilClose === 0
      || item.preparationTime <= minutesUntilClose;
    const matchesAvailability = showUnavailable ? true : (item.available && item.quantity > 0);
    return matchesSearch && matchesCategory && canPrepare && matchesAvailability;
  }).sort((a, b) => {
    const aAvailable = a.available && a.quantity > 0;
    const bAvailable = b.available && b.quantity > 0;
    if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
    return 0;
  });

  const availableCount = menuItems.filter((i) => i.available).length;
  const availableItems = filteredItems.filter(i => i.available && i.quantity > 0);
  const unavailableItems = filteredItems.filter(i => !i.available || i.quantity <= 0);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24, filter: "blur(4px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="min-h-screen bg-zayko-900 pb-28 md:pb-24 relative overflow-x-hidden overflow-y-auto">

      {/* ── Floating Blobs (Background) ── */}
      <div className="premium-blob premium-blob-1 top-[-100px] right-[-80px]" />
      <div className="premium-blob premium-blob-2 top-[200px] left-[-60px]" />
      <div className="premium-blob premium-blob-3 bottom-[300px] right-[10%]" />

      {/* ══════════════════════════════════════
          HERO GREETING SECTION
         ══════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative hero-gradient"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
          <div className="flex items-center justify-between">
            {/* Greeting */}
            <div className="min-w-0 flex-1">
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-xs sm:text-sm text-zayko-400 font-medium mb-0.5"
              >
                {getGreeting()} ☀️
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-white truncate"
              >
                {profile?.name ? `${profile.name.split(" ")[0]}` : "Welcome"}
              </motion.h1>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 mt-1.5"
              >
                <span className={`w-2 h-2 rounded-full ${isCanteenOpen ? "bg-emerald-400 shadow-lg shadow-emerald-400/50" : "bg-red-400"}`}>
                  {isCanteenOpen && <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                </span>
                <span className="text-[11px] sm:text-xs text-zayko-400">
                  {isCanteenOpen ? "Canteen Open" : "Canteen Closed"}
                  {minutesUntilClose !== null && minutesUntilClose > 0 && isCanteenOpen
                    ? ` · Closes in ${minutesUntilClose}m`
                    : ""}
                </span>
              </motion.div>
            </div>

            {/* Wallet Chip */}
            {profile && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
              >
                <Link
                  href="/wallet"
                  className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-gold-400/20 hover:shadow-[0_0_20px_rgba(251,191,36,0.08)] transition-all duration-300 backdrop-blur-xl"
                >
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-gold-400 group-hover:scale-110 transition-transform duration-200" />
                  <span className="price-premium text-sm sm:text-base">₹{profile.walletBalance || 0}</span>
                </Link>
              </motion.div>
            )}
          </div>
        </div>

        {/* Subtle gradient fade at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zayko-900 to-transparent" />
      </motion.div>



      {/* ══════════════════════════════════════
          SEARCH & FILTERS — Premium Sticky Bar
         ══════════════════════════════════════ */}
      <div className="sticky top-[56px] sm:top-[64px] z-30 backdrop-blur-2xl bg-zayko-900/80 border-b border-white/[0.04]">
        <div className="px-4 sm:px-6 max-w-7xl mx-auto py-3 space-y-3">
          {/* Search Input */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zayko-400 w-4 h-4 group-focus-within:text-gold-400 transition-colors duration-200" />
            <input
              type="text"
              placeholder="Search menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.06] text-white placeholder:text-zayko-500 focus:outline-none focus:ring-2 focus:ring-gold-400/25 focus:border-gold-400/25 focus:shadow-[0_0_30px_rgba(251,191,36,0.08)] text-sm transition-all duration-300 focus:bg-white/[0.08] backdrop-blur-md"
            />
            <AnimatePresence>
              {search && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zayko-400 hover:text-white transition-colors p-0.5"
                >
                  <div className="bg-white/10 hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center transition-colors">
                    <X className="w-3 h-3" />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Category Cards — Premium Icon Grid */}
          <div className="flex gap-2 overflow-x-auto md:flex-wrap scrollbar-hide pb-2 md:pb-0 -mx-1 px-1">
            {/* "All" card */}
            <motion.button
              onClick={() => setCategory("all")}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.04, y: -2 }}
              className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-300 shrink-0 min-w-[72px] border ${
                category === "all"
                  ? "bg-gradient-to-br from-gold-400 to-gold-500 text-zayko-900 border-gold-400/40 shadow-[0_4px_20px_rgba(251,191,36,0.35)]"
                  : "bg-white/[0.04] text-zayko-300 border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12]"
              }`}
            >
              <div className={`p-1.5 rounded-full ${category === "all" ? "bg-white/20" : "bg-white/5"}`}>
                <Utensils className="w-5 h-5" />
              </div>
              <span>All</span>
            </motion.button>
            {categories.map((cat) => {
              const icons: Record<string, React.JSX.Element> = {
                // Core meals
                breakfast: <GiBread />, lunch: <GiMeal />, dinner: <GiMeal />,
                "indian-meals": <GiMeal />, thali: <GiMeal />, biryani: <GiMeal />,
                // Fast food / street
                "fast-food": <GiFrenchFries />, "street-food": <GiTacos />, snack: <GiFrenchFries />, snacks: <GiCupcake />,
                // Specific cuisines
                "chinese-food": <GiNoodles />, chinese: <GiNoodles />, "south-indian": <GiBread />,
                "south-indians": <GiBread />, "north-indian": <GiMeal />,
                // Popular items
                pizza: <GiPizzaSlice />, burgers: <GiHamburger />, burger: <GiHamburger />,
                sandwiches: <GiSandwich />, sandwich: <GiSandwich />,
                "rolls-wraps": <GiTacos />, rolls: <GiTacos />, wraps: <GiTacos />,
                "noodles-pasta": <GiNoodles />, noodles: <GiNoodles />, pasta: <GiNoodles />,
                momos: <GiDumpling />, chaat: <GiMeal />,
                // Parathas & bread
                parathas: <GiBread />, paratha: <GiBread />, roti: <GiBread />, bread: <GiBread />,
                // Healthy
                "healthy-food": <Salad />, healthy: <Salad />, salad: <Salad />,
                // Drinks
                beverages: <GiWaterBottle />, beverage: <GiWaterBottle />,
                "tea-coffee": <GiCoffeeCup />, "tea-&-coffee": <GiCoffeeCup />, tea: <GiTeapot />, coffee: <GiCoffeeCup />,
                "fresh-juices": <GiWaterBottle />, "fresh-juice": <GiWaterBottle />, juice: <GiWaterBottle />, juices: <GiWaterBottle />,
                smoothie: <GiWaterBottle />, shake: <GiWaterBottle />, lassi: <GiWaterBottle />,
                // Frozen / Ice cream
                "ice-cream": <GiIceCreamCone />, icecream: <GiIceCreamCone />, "ice-creams": <GiIceCreamCone />,
                // Sweets / Desserts
                desserts: <GiCupcake />, dessert: <GiCupcake />, sweets: <GiCupcake />, mithai: <GiCupcake />,
                // Combos
                combo: <GiMeal />, combos: <GiMeal />, "meal-combo": <GiMeal />,
                // Extras
                extras: <GiMeal />, sides: <Salad />, dips: <GiMeal />,
                // Fallback
                default: <Utensils />,
              };
              const icon = icons[cat.slug] || icons["default"];
              const isActive = category === cat.slug;
              return (
                <motion.button
                  key={cat.id}
                  onClick={() => setCategory(cat.slug)}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.04, y: -2 }}
                  className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-300 shrink-0 min-w-[72px] border ${
                    isActive
                      ? "bg-gradient-to-br from-gold-400 to-gold-500 text-zayko-900 border-gold-400/40 shadow-[0_4px_20px_rgba(251,191,36,0.35)]"
                      : "bg-white/[0.04] text-zayko-300 border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12]"
                  }`}
                >
                  <div className={`p-1.5 rounded-full ${isActive ? "bg-white/20" : "bg-white/5"}`}>
                    {React.cloneElement(icon, { className: "w-5 h-5" })}
                  </div>
                  <span>{cat.name}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Item count + Colorful toggle */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs text-zayko-500 font-medium">{availableCount} items available</p>
            <button
              onClick={() => setShowUnavailable(!showUnavailable)}
              className="flex items-center gap-2 group"
            >
              <div className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                showUnavailable
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  : "bg-gray-400/30 border border-gray-400/20"
              }`}>
                <motion.div
                  className="absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-md"
                  animate={{ left: showUnavailable ? "calc(100% - 21px)" : "3px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold transition-colors duration-200 ${
                showUnavailable ? "text-emerald-400" : "text-zayko-400"
              }`}>
                {showUnavailable ? "Showing All" : "Unavailable"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          TRENDING NOW — Animated Carousel (One at a time)
         ══════════════════════════════════════ */}
      {availableItems.length > 0 && !search && category === "all" && (
        <motion.section
          className="mt-4 mb-4 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 rounded-full bg-gradient-to-b from-gold-400 to-gold-500 shadow-[0_0_12px_rgba(251,191,36,0.5)]" />
              <div>
                <h2 className="text-lg sm:text-xl font-display font-bold text-white">Trending Now</h2>
                <p className="text-[10px] sm:text-xs text-zayko-500">Most popular this week</p>
              </div>
            </div>
            <motion.span
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[10px] sm:text-xs font-bold text-gold-400 bg-gold-400/10 px-3 py-1 rounded-full border border-gold-400/20"
            >
              🔥 HOT
            </motion.span>
          </div>

          <TrendingCarousel items={availableItems} />
        </motion.section>
      )}

      {/* ══════════════════════════════════════
          MENU GRID — Premium Layout
         ══════════════════════════════════════ */}
      <div className="px-4 sm:px-6 max-w-7xl mx-auto mt-5 sm:mt-6 space-y-8 sm:space-y-10 relative z-10">
        {menuLoading ? (
          /* Premium Loading Skeleton */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="skeleton-premium aspect-[4/3]" />
                <div className="p-4 space-y-2 bg-zayko-800/30">
                  <div className="skeleton-premium h-4 w-3/4" />
                  <div className="skeleton-premium h-3 w-1/2" />
                  <div className="skeleton-premium h-10 w-full mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center py-16 sm:py-20 premium-glass-card"
          >
            <div className="text-5xl sm:text-6xl mb-3">🍽️</div>
            <h3 className="text-lg sm:text-xl font-display font-bold text-white mb-1">No items found</h3>
            <p className="text-sm text-zayko-400">
              {search ? `No results for "${search}"` : "The menu is empty right now"}
            </p>
          </motion.div>
        ) : (
          <>
            {/* ── Available Section ── */}
            {availableItems.length > 0 && (
              <section>
                <motion.div
                  className="flex items-center gap-3 mb-5"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <div className="w-1 h-7 bg-gradient-to-b from-emerald-400 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                  <h2 className="text-lg sm:text-xl font-display font-bold text-white">Available Now</h2>
                  <span className="text-[10px] sm:text-xs text-emerald-400/70 bg-emerald-400/10 px-2 py-0.5 rounded-full font-semibold">{availableItems.length}</span>
                </motion.div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                  {availableItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{
                        duration: 0.5,
                        ease: "easeOut",
                        delay: Math.min(index * 0.08, 0.4) // cap delay
                      }}
                    >
                      <MenuCard {...item} index={index} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Unavailable Section ── */}
            {showUnavailable && unavailableItems.length > 0 && (
              <section>
                <motion.div
                  className="flex items-center gap-3 mb-5 pt-4 sm:pt-6 border-t border-white/[0.04]"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <div className="w-1 h-7 bg-zayko-600 rounded-full" />
                  <h2 className="text-lg sm:text-xl font-display font-bold text-zayko-300">Not Available</h2>
                  <span className="text-[10px] sm:text-xs text-zayko-500 bg-white/[0.04] px-2 py-0.5 rounded-full font-semibold">{unavailableItems.length}</span>
                </motion.div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                  {unavailableItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{
                        duration: 0.5,
                        ease: "easeOut",
                        delay: Math.min(index * 0.08, 0.4) // cap delay
                      }}
                    >
                      <MenuCard {...item} index={availableItems.length + index} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {showUnavailable && unavailableItems.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-zayko-400 italic text-sm text-center py-4"
              >
                All items are available! 🎉
              </motion.p>
            )}
          </>
        )}
      </div>



      {/* Scheduled Order Modal */}
      <ScheduledOrderModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
      />
    </div>
  );
}
