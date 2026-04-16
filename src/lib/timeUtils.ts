/**
 * Time Utilities for 24h <-> 12h conversions
 */

export interface Time12h {
    hour: number;
    minute: string;
    period: "AM" | "PM";
}

/**
 * Converts "14:30" or "09:00" to { hour: 2, minute: "30", period: "PM" }
 */
export const convertTo12h = (time24: string): Time12h => {
    if (!time24 || !time24.includes(":")) {
        return { hour: 12, minute: "00", period: "AM" };
    }
    const [h, m] = time24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    let hour = h % 12;
    if (hour === 0) hour = 12;
    const minute = String(m).padStart(2, "0");
    return { hour, minute, period };
};

/**
 * Converts { hour: 2, minute: "30", period: "PM" } to "14:30"
 */
export const convertTo24h = (time12: Time12h): string => {
    let h = time12.hour;
    if (time12.period === "PM" && h < 12) h += 12;
    if (time12.period === "AM" && h === 12) h = 0;
    const hour = String(h).padStart(2, "0");
    const minute = time12.minute.padStart(2, "0");
    return `${hour}:${minute}`;
};

/**
 * Formats a 24h string into a pretty 12h string e.g. "09:00" -> "9:00 AM"
 */
export const formatTime12h = (time24: string): string => {
    const { hour, minute, period } = convertTo12h(time24);
    return `${hour}:${minute} ${period}`;
};
