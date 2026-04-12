/**
 * ThemeContext — Multi-theme state management for user section
 *
 * Features:
 * - 6 premium themes (dark, light, midnight, cyberpunk, minimal, canteen)
 * - localStorage persistence
 * - Time-based auto theme switching (optional)
 * - Scoped via data-theme attribute (doesn't affect admin/stock/executive)
 * - Minimal re-renders via memoized context value
 */

"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";

// ── Theme types ──────────────────────────────────────────
export type Theme = "midnight" | "light" | "ember" | "ocean" | "forest";

export interface ThemeConfig {
  id: Theme;
  name: string;
  icon: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    card: string;
  };
}

export const THEMES: ThemeConfig[] = [
  {
    id: "midnight",
    name: "Midnight",
    icon: "🌙",
    description: "Premium dark interface",
    colors: { primary: "#0A0A0F", secondary: "#13131A", accent: "#6C63FF", card: "#1C1C27" },
  },
  {
    id: "light",
    name: "Light",
    icon: "☀️",
    description: "Clean & bright",
    colors: { primary: "#F8F7F4", secondary: "#FFFFFF", accent: "#FF6B35", card: "#F0EEE9" },
  },
  {
    id: "ember",
    name: "Ember",
    icon: "🔥",
    description: "Bold & energetic",
    colors: { primary: "#0F0A08", secondary: "#1A1008", accent: "#FF4500", card: "#261808" },
  },
  {
    id: "ocean",
    name: "Ocean",
    icon: "🌊",
    description: "Cool & modern",
    colors: { primary: "#060D1F", secondary: "#0D1829", accent: "#00D4FF", card: "#142035" },
  },
  {
    id: "forest",
    name: "Forest",
    icon: "🌿",
    description: "Organic & premium",
    colors: { primary: "#080F0A", secondary: "#0F1A10", accent: "#1DB954", card: "#162318" },
  },
];

// ── Context shape ────────────────────────────────────────
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isPanelOpen: boolean;
  togglePanel: () => void;
  closePanel: () => void;
  autoTheme: boolean;
  setAutoTheme: (v: boolean) => void;
  themeConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "zayko-theme";
const AUTO_THEME_KEY = "zayko-auto-theme";

// ── Helper: get theme from time of day ───────────────────
function getTimeBasedTheme(): Theme {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 19) return "light";
  return "midnight";
}

// ── Provider ─────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("midnight");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [autoTheme, setAutoThemeState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const storedAuto = localStorage.getItem(AUTO_THEME_KEY) === "true";

      if (storedAuto) {
        setAutoThemeState(true);
        setThemeState(getTimeBasedTheme());
      } else if (stored && THEMES.some((t) => t.id === stored)) {
        setThemeState(stored);
      }
    } catch {
      // SSR or localStorage unavailable
    }
    setMounted(true);
  }, []);

  // Auto-theme interval
  useEffect(() => {
    if (!autoTheme) return;

    const checkTheme = () => setThemeState(getTimeBasedTheme());
    checkTheme();
    const interval = setInterval(checkTheme, 60_000); // check every minute
    return () => clearInterval(interval);
  }, [autoTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setAutoThemeState(false);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
      localStorage.setItem(AUTO_THEME_KEY, "false");
    } catch {
      // noop
    }
  }, []);

  const setAutoTheme = useCallback((v: boolean) => {
    setAutoThemeState(v);
    try {
      localStorage.setItem(AUTO_THEME_KEY, String(v));
      if (v) {
        const timeTheme = getTimeBasedTheme();
        setThemeState(timeTheme);
        localStorage.setItem(STORAGE_KEY, timeTheme);
      }
    } catch {
      // noop
    }
  }, []);

  const togglePanel = useCallback(() => setIsPanelOpen((p) => !p), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const themeConfig = useMemo(
    () => THEMES.find((t) => t.id === theme) || THEMES[0],
    [theme]
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      isPanelOpen,
      togglePanel,
      closePanel,
      autoTheme,
      setAutoTheme,
      themeConfig,
    }),
    [theme, setTheme, isPanelOpen, togglePanel, closePanel, autoTheme, setAutoTheme, themeConfig]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        data-theme={mounted ? theme : "midnight"}
        className="min-h-screen transition-colors duration-300"
        style={{
          background: "var(--bg-primary, #0A0A0F)",
          color: "var(--text-primary, #E8E8F0)",
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────
export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
