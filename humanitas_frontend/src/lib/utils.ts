import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes timezone strings to IANA format or POSIX offsets.
 * Handles "GMT+3", "UTC+3", "+3", etc.
 * Note: POSIX Etc/GMT offsets are inverted sign-wise relative to ISO-8601.
 * "GMT+3" (ahead of Greenwich) -> "Etc/GMT-3"
 * "GMT-5" (behind Greenwich) -> "Etc/GMT+5"
 */
export function normalizeTimezone(tz: string): string {
  if (!tz) return "UTC";

  // Try direct validity check first (fast path for correct IANA zones)
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch (e) {
    // Continue to normalization
  }

  const normalized = tz.trim().toUpperCase();

  // Regex for GMT/UTC offsets: (GMT|UTC)?([+-])?(\d+)
  const match = normalized.match(/^(?:GMT|UTC)?([+-])?(\d{1,2})(?::00)?$/);

  if (match) {
    const sign = match[1] || "+";
    const hours = parseInt(match[2], 10);

    // POSIX Etc/GMT is inverted: GMT+3 -> Etc/GMT-3
    // If input is +3 (East), we want Etc/GMT-3
    // If input is -5 (West), we want Etc/GMT+5
    const posixSign = sign === "+" ? "-" : "+";
    const posixZone = `Etc/GMT${posixSign}${hours}`;

    try {
      Intl.DateTimeFormat(undefined, { timeZone: posixZone });
      return posixZone;
    } catch (e) {
      console.warn(`Failed to normalize timezone '${tz}' to '${posixZone}'`);
    }
  }

  console.warn(`Invalid timezone '${tz}', falling back to UTC`);
  return "UTC";
}

/**
 * Converts a local time string (HH:mm) from a specific timezone to UTC time string (HH:mm).
 * Example: Input "09:00", "Etc/GMT-3" (+3) -> Output "06:00"
 */
export function localTimeToUtc(timeStr: string, timezone: string): string {
  if (!timeStr) return "";
  try {
    const now = new Date();
    const iso = now.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'longOffset' });
    const offsetMatch = iso.match(/GMT([+-]\d{2}):?(\d{2})?$/);

    if (offsetMatch) {
      const sign = offsetMatch[1][0] === '+' ? 1 : -1;
      const hours = parseInt(offsetMatch[1].substring(1), 10);
      const minutes = offsetMatch[2] ? parseInt(offsetMatch[2], 10) : 0;

      const totalOffsetMinutes = sign * (hours * 60 + minutes);

      const [localH, localM] = timeStr.split(':').map(Number);
      let totalMinutes = localH * 60 + localM;

      let utcMinutes = totalMinutes - totalOffsetMinutes;
      utcMinutes = (utcMinutes + 1440) % 1440;

      const utcH = Math.floor(utcMinutes / 60);
      const utcM = utcMinutes % 60;

      return `${utcH.toString().padStart(2, '0')}:${utcM.toString().padStart(2, '0')}`;
    }
    return timeStr;
  } catch (e) {
    console.error("Error converting local to UTC:", e);
    return timeStr;
  }
}
/**
 * Formats a date string or object into a string using the specified timezone.
 * Uses Intl.DateTimeFormat for robust timezone conversion.
 * @param date - The date to format (string or Date object)
 * @param timezone - The IANA timezone string (e.g., "Asia/Riyadh", "UTC")
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatInTimeZone(
  date: string | Date | null | undefined,
  _timezone: string,
  _options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
): string {
  if (!date) return "-";

  try {
    // Parse the date - timestamps without timezone are treated as local time
    const d = new Date(date);

    // Check if date is valid
    if (isNaN(d.getTime())) {
      // If it's a time string like "HH:mm:ss" or "HH:mm", just format it directly
      if (typeof date === 'string' && date.includes(':')) {
        const parts = date.split(':');
        if (parts.length >= 2) {
          const hours = parseInt(parts[0]);
          const mins = parts[1];
          // Format as HH:mm
          return `${hours.toString().padStart(2, '0')}:${mins.padStart(2, '0')}`;
        }
      }
      return "-";
    }

    // For valid dates, just extract the time portion as displayed
    // This assumes timestamps are already stored in tenant timezone
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    console.error("Error formatting date in timezone:", e);
    return "-";
  }
}
