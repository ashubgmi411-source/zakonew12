"use client";
import React, { useState, useEffect } from "react";
import { convertTo12h, convertTo24h, Time12h } from "@/lib/timeUtils";

interface TimePickerAMPMProps {
    value: string; // 24h format "HH:mm"
    onChange: (value: string) => void;
    label?: string;
}

export default function TimePickerAMPM({ value, onChange, label }: TimePickerAMPMProps) {
    const [timeObj, setTimeObj] = useState<Time12h>(convertTo12h(value));

    // Update internal state when external value changes
    useEffect(() => {
        setTimeObj(convertTo12h(value));
    }, [value]);

    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let h = parseInt(e.target.value) || 0;
        if (h > 12) h = 12;
        if (h < 1) h = 1;
        const newObj = { ...timeObj, hour: h };
        setTimeObj(newObj);
        onChange(convertTo24h(newObj));
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let m = e.target.value.replace(/\D/g, "");
        if (parseInt(m) > 59) m = "59";
        const newObj = { ...timeObj, minute: m.padStart(2, "0") };
        setTimeObj(newObj);
        onChange(convertTo24h(newObj));
    };

    const togglePeriod = () => {
        const newObj: Time12h = { ...timeObj, period: timeObj.period === "AM" ? "PM" : "AM" };
        setTimeObj(newObj);
        onChange(convertTo24h(newObj));
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
                        type="number"
                        min="1"
                        max="12"
                        value={timeObj.hour}
                        onChange={handleHourChange}
                        onBlur={() => {
                            if (timeObj.hour === 0) setTimeObj({ ...timeObj, hour: 12 });
                        }}
                        className="w-full bg-transparent text-center text-lg font-mono font-bold text-white focus:outline-none placeholder:text-white/20"
                        placeholder="12"
                    />
                    <span className="text-zayko-500 font-bold px-0.5 animate-pulse">:</span>
                    <input
                        type="text"
                        maxLength={2}
                        value={timeObj.minute}
                        onChange={handleMinuteChange}
                        className="w-full bg-transparent text-center text-lg font-mono font-bold text-white focus:outline-none placeholder:text-white/20"
                        placeholder="00"
                    />
                </div>
                <button
                    onClick={(e) => { e.preventDefault(); togglePeriod(); }}
                    className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all duration-300 min-w-[50px] shadow-sm ${
                        timeObj.period === "AM"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    }`}
                >
                    {timeObj.period}
                </button>
            </div>
        </div>
    );
}
