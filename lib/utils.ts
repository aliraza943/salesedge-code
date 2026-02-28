import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  parseLocalDate,
  getLocalTodayStr,
  formatDateLongTz,
  formatDateShortTz,
  getGreetingTz,
} from "./timezone";

/**
 * Combines class names using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts 24-hour time string (HH:MM) to 12-hour format (e.g., 2:00 PM).
 */
export function formatTime(time: string | undefined | null): string {
  if (!time) return "";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return time;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Formats a time range from 24-hour to 12-hour format.
 */
export function formatTimeRange(start: string | undefined | null, end: string | undefined | null): string {
  if (!start) return "";
  const startFormatted = formatTime(start);
  if (!end) return startFormatted;
  return `${startFormatted} - ${formatTime(end)}`;
}

/**
 * Formats a date string (YYYY-MM-DD) to a human-readable format.
 * Uses timezone-safe parsing (noon local time).
 */
export function formatDateLong(dateStr: string): string {
  return formatDateLongTz(dateStr);
}

/**
 * Formats a date string to short format (e.g., "Feb 18").
 * Uses timezone-safe parsing (noon local time).
 */
export function formatDateShort(dateStr: string): string {
  return formatDateShortTz(dateStr);
}

/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 */
export function getTodayStr(): string {
  return getLocalTodayStr();
}

/**
 * Returns the number of days from today to a target date.
 * Uses timezone-safe parsing.
 */
export function daysUntil(dateStr: string): number {
  const target = parseLocalDate(dateStr);
  target.setHours(23, 59, 59, 0);
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Formats a currency string (e.g., "50000" → "$50K").
 */
export function formatCurrency(value: string | null | undefined): string {
  if (!value) return "$0";
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "$0";
  if (num >= 1000000) return "$" + (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return "$" + (num / 1000).toFixed(0) + "K";
  return "$" + num.toFixed(0);
}

/**
 * Formats a currency string with full precision (e.g., "50000" → "$50,000").
 */
export function formatCurrencyFull(value: string | null | undefined): string {
  if (!value) return "";
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return value;
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Returns a greeting based on the time of day in the user's local timezone.
 */
export function getGreeting(): string {
  return getGreetingTz();
}

/**
 * Counts business days (Mon-Fri) between two dates, inclusive of start, exclusive of end.
 * If start is today, it includes today as a work day.
 */
export function countWorkDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Formats a large currency number with commas (e.g., 4900000 → "$4,900,000").
 */
export function formatCurrencyLarge(num: number): string {
  if (num >= 1000000) {
    return "$" + (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
