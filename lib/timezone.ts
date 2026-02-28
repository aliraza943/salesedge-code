/**
 * Centralized timezone utilities.
 *
 * All date/time operations should go through these helpers to ensure
 * the user's local timezone is respected regardless of where they are.
 *
 * Key principle: dates stored as "YYYY-MM-DD" are calendar dates (no timezone).
 * We always parse them at noon local time to avoid day-boundary shifts.
 */

/**
 * Returns the user's IANA timezone string (e.g., "America/New_York", "America/Chicago").
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Safely parses a YYYY-MM-DD date string into a Date object at noon local time.
 * This prevents the UTC-midnight interpretation that shifts dates backward
 * for users in negative-UTC timezones (all US timezones).
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // If it already has a time component, parse as-is
  if (dateStr.includes("T")) return new Date(dateStr);
  // Parse at noon local time to avoid day-boundary shifts
  return new Date(dateStr + "T12:00:00");
}

/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 */
export function getLocalTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Returns the current local date/time components.
 */
export function getLocalNow() {
  const now = new Date();
  return {
    date: getLocalTodayStr(),
    hours: now.getHours(),
    minutes: now.getMinutes(),
    dayOfWeek: now.getDay(),
    timezone: getUserTimezone(),
  };
}

/**
 * Formats a YYYY-MM-DD date string to a localized long format.
 * e.g., "Saturday, February 28, 2026"
 */
export function formatDateLongTz(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Formats a YYYY-MM-DD date string to a localized short format.
 * e.g., "Feb 28"
 */
export function formatDateShortTz(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Formats a YYYY-MM-DD date string with weekday and short month.
 * e.g., "Saturday, Feb 28"
 */
export function formatDateWithWeekday(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats a YYYY-MM-DD date string with month, day, year.
 * e.g., "Feb 28, 2026"
 */
export function formatDateMedium(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats an ISO datetime string to a localized date + time.
 * e.g., "Feb 28, 2026 at 3:45 PM"
 */
export function formatDateTimeTz(isoStr: string): string {
  const d = new Date(isoStr);
  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} at ${timePart}`;
}

/**
 * Returns a relative time string (e.g., "2h ago", "3d ago", "Feb 28").
 */
export function timeAgoTz(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Gets the day of week name from a YYYY-MM-DD string.
 */
export function getDayOfWeekName(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Compares two YYYY-MM-DD date strings. Returns true if they represent the same calendar day.
 */
export function isSameDay(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 === dateStr2;
}

/**
 * Returns the greeting based on local time of day.
 */
export function getGreetingTz(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}
