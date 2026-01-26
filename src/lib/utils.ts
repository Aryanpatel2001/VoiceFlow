import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with Tailwind CSS conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as currency
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Formats a number with compact notation (1K, 1M, etc.)
 */
export function formatCompactNumber(num: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(num);
}

/**
 * Formats duration in seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Formats a phone number to (XXX) XXX-XXXX format
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const match = cleaned.match(/^(\d{1,3})?(\d{3})(\d{3})(\d{4})$/);

  if (match) {
    const intlCode = match[1] ? `+${match[1]} ` : "";
    return `${intlCode}(${match[2]}) ${match[3]}-${match[4]}`;
  }

  return phone;
}

/**
 * Truncates text with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

/**
 * Generates a random ID
 */
export function generateId(prefix: string = ""): string {
  const id = Math.random().toString(36).substring(2, 11);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Checks if code is running on server
 */
export const isServer = typeof window === "undefined";

/**
 * Checks if code is running on client
 */
export const isClient = !isServer;

/**
 * Sleep utility for async operations
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Calculate relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);

  const intervals = [
    { unit: "year" as const, seconds: 31536000 },
    { unit: "month" as const, seconds: 2592000 },
    { unit: "week" as const, seconds: 604800 },
    { unit: "day" as const, seconds: 86400 },
    { unit: "hour" as const, seconds: 3600 },
    { unit: "minute" as const, seconds: 60 },
    { unit: "second" as const, seconds: 1 },
  ];

  for (const { unit, seconds } of intervals) {
    const interval = Math.floor(diffInSeconds / seconds);
    if (Math.abs(interval) >= 1) {
      return rtf.format(interval, unit);
    }
  }

  return "just now";
}
