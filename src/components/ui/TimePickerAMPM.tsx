"use client";
import React, { useState, useEffect } from "react";
import { convertTo12h, convertTo24h, Time12h } from "@/lib/timeUtils";

interface TimePickerAMPMProps {
    value: string; // 24h format "HH:mm"
    onChange: (value: string) => void;
    label?: string;
}

export default function TimePickerAMPM({ value, onChange, label }: TimePickerAMPMProps) {
    const initialTime = convertTo12h(value);
    const [hStr, setHStr] = useState<string>(String(initialTime.hour));
    const [mStr, setMStr] = useState<string>(initialTime.minute);
    const [period, setPeriod] = useState<"AM" | "PM">(initialTime.period);

    // Update internal state when external value changes
    useEffect(() => {
        const t = convertTo12h(value);
        setHStr(String(t.hour));
        setMStr(t.minute);
        setPeriod(t.period);
    }, [value]);

    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, "");
        if (val.length > 2) return;
        setHStr(val);
        
        // If it's a valid hour, update parent immediately but keep local string
        const hNum = parseInt(val);
        if (hNum >= 1 && hNum <= 12) {
            onChange(convertTo24h({ hour: hNum, minute: mStr || "00", period }));
        }
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, "");
        if (val.length > 2) return;
        setMStr(val);

        // If it's a valid minute, update parent
        const mNum = parseInt(val);
        if (mNum >= 0 && mNum <= 59 && val.length === 2) {
            onChange(convertTo24h({ hour: parseInt(hStr) || 12, minute: val, period }));
        }
    };

    const validateAndClamp = () => {
        let h = parseInt(hStr) || 12;
        if (h > 12) h = 12;
        if (h < 1) h = 1;

        let m = parseInt(mStr) || 0;
        if (m > 59) m = 59;
        if (m < 0) m = 0;

        const mFinal = String(m).padStart(2, "0");
        setHStr(String(h));
        setMStr(mFinal);
        
        onChange(convertTo24h({ hour: h, minute: mFinal, period }));
    };

    const togglePeriod = () => {
        const newPeriod = period === "AM" ? "PM" : "AM";
        setPeriod(newPeriod);
        onChange(convertTo24h({ hour: parseInt(hStr) || 12, minute: mStr.padStart(2, "0"), period: newPeriod }));
    };

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label className="text-[10px] font-bold text-zayko-400 uppercase tracking-widest px-1">
                    {label}
                </label>
            )}
            <div className="flex items-center gap-1 bg-zayko-900 border border-white/5 rounded-2xl p-1 shadow-inner ring-1 ring-white/5 overflow-hidden">
                <div className="flex items-center flex-1">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={hStr}
                        onChange={handleHourChange}
                        onBlur={validateAndClamp}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-transparent text-center text-lg font-mono font-bold text-white focus:outline-none placeholder:text-white/20"
                        placeholder="12"
                    />
                    <span className="text-zayko-500 font-bold px-0.5 animate-pulse">:</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={mStr}
                        onChange={handleMinuteChange}
                        onBlur={validateAndClamp}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-transparent text-center text-lg font-mono font-bold text-white focus:outline-none placeholder:text-white/20"
                        placeholder="00"
                    />
                </div>
                <button
                    onClick={(e) => { e.preventDefault(); togglePeriod(); }}
                    className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all duration-300 min-w-[50px] shadow-sm ${
                        period === "AM"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    }`}
                >
                    {period}
                </button>
            </div>
        </div>
    );
}
