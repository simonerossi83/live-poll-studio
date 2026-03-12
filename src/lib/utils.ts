import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Security utilities
// ---------------------------------------------------------------------------

/** UUID v4 format check */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Sanitise user-facing text: strip HTML tags and limit length */
export function sanitizeText(input: string, maxLength = 500): string {
  return input
    .replace(/<[^>]*>/g, "")   // strip HTML tags
    .replace(/[<>"'&]/g, "")   // strip remaining dangerous chars
    .trim()
    .slice(0, maxLength);
}

/** Validate selected_option_index is a safe non-negative integer */
export function isValidOptionIndex(value: unknown, maxOptions = 6): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < maxOptions;
}
