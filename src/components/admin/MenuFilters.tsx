"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * MenuFilters — Search + Filter bar for admin menu management.
 *
 * Features:
 *  - Debounced name search (300 ms) with clear button
 *  - Category dropdown (dynamic from Firestore)
 *  - Availability status dropdown
 *  - Item count summary
 */

export type AvailabilityFilter = "all" | "available" | "unavailable";

interface MenuFiltersProps {
    categoryFilter: string;
    availabilityFilter: AvailabilityFilter;
    onCategoryChange: (value: string) => void;
    onAvailabilityChange: (value: AvailabilityFilter) => void;
    onSearchChange: (value: string) => void;
    searchQuery: string;
    /** Total items (unfiltered) */
    totalCount: number;
    /** Filtered items count */
    filteredCount: number;
    /** Dynamic categories from Firestore */
    dynamicCategories?: { value: string; label: string }[];
}

const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; label: string }[] = [
    { value: "all", label: "All Status" },
    { value: "available", label: "✅ Available" },
    { value: "unavailable", label: "❌ Unavailable" },
];

export default function MenuFilters({
    categoryFilter,
    availabilityFilter,
    onCategoryChange,
    onAvailabilityChange,
    onSearchChange,
    searchQuery,
    totalCount,
    filteredCount,
    dynamicCategories = [],
}: MenuFiltersProps) {
    // Local input value — we debounce before calling onSearchChange
    const [inputValue, setInputValue] = useState(searchQuery);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync external clear (e.g. "clear all filters" button in parent)
    useEffect(() => {
        setInputValue(searchQuery);
    }, [searchQuery]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onSearchChange(val);
        }, 300);
    };

    const handleClear = () => {
        setInputValue("");
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onSearchChange("");
    };

    const categoryOptions = [
        { value: "all", label: "All Categories" },
        ...dynamicCategories,
    ];

    const isFiltered =
        searchQuery !== "" ||
        categoryFilter !== "all" ||
        availabilityFilter !== "all";

    return (
        <div className="bg-zayko-800/50 border border-zayko-700 rounded-xl p-4 mb-4 space-y-3">
            {/* ── Row 1: Search ──────────────────────────── */}
            <div className="relative">
                {/* Search icon */}
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zayko-400 pointer-events-none select-none">
                    🔍
                </span>

                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Search items by name…"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-zayko-700 border border-zayko-600 text-white placeholder:text-zayko-500 text-sm focus:ring-2 focus:ring-gold-400 focus:outline-none transition-all"
                />

                {/* Clear button — only visible when there is input */}
                {inputValue && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-zayko-600 hover:bg-zayko-500 text-zayko-300 hover:text-white transition-all text-xs"
                        aria-label="Clear search"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* ── Row 2: Dropdowns + Count ────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* Category */}
                <div className="flex items-center gap-2">
                    <label 
                        className="text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: 'var(--brand-gold)' }}
                    >
                        Category
                    </label>
                    <select
                        value={categoryFilter}
                        onChange={(e) => onCategoryChange(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-zayko-700 border border-zayko-600 text-white text-sm focus:ring-2 focus:ring-gold-400 focus:outline-none min-w-[160px]"
                    >
                        {categoryOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Availability */}
                <div className="flex items-center gap-2">
                    <label 
                        className="text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: 'var(--brand-gold)' }}
                    >
                        Status
                    </label>
                    <select
                        value={availabilityFilter}
                        onChange={(e) =>
                            onAvailabilityChange(e.target.value as AvailabilityFilter)
                        }
                        className="px-3 py-2 rounded-lg bg-zayko-700 border border-zayko-600 text-white text-sm focus:ring-2 focus:ring-gold-400 focus:outline-none min-w-[160px]"
                    >
                        {AVAILABILITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Results count + clear all */}
                <div className="sm:ml-auto flex items-center gap-3">
                    <span className="text-zayko-400 text-xs font-medium">
                        Showing{" "}
                        <span className="text-zayko-200 font-bold">{filteredCount}</span>{" "}
                        of{" "}
                        <span className="text-zayko-200 font-bold">{totalCount}</span>{" "}
                        items
                    </span>
                    {isFiltered && (
                        <button
                            onClick={() => {
                                handleClear();
                                onCategoryChange("all");
                                onAvailabilityChange("all");
                            }}
                            className="text-xs text-gold-400 hover:text-gold-300 font-medium transition-colors whitespace-nowrap"
                        >
                            Clear all ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
