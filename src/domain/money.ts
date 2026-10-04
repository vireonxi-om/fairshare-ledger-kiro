/**
 * Exact money parsing and formatting.
 *
 * Amounts are parsed from decimal text directly to integer paise using string
 * operations, so no floating-point rounding error is introduced. Formatting
 * divides by 100 only at the display edge.
 */

import { MAX_EXPENSE_PAISE } from "./types";

const MONEY_RE = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parse user-entered decimal text into integer paise.
 *
 * Accepts a non-negative integer part and an optional fractional part of 1–2
 * digits (e.g. "0", "10", "10.5", "10.50", "1234.05"). Leading/trailing
 * whitespace is ignored. Returns null for anything else (signs, exponents,
 * more than two fractional digits, empty, non-numeric).
 *
 * Precision contract: the integer part and the two-digit fractional part are
 * combined as `Number(intPart) * 100 + Number(frac2)`. This is exact as long as
 * the result does not exceed MAX_EXPENSE_PAISE, which is well below
 * Number.MAX_SAFE_INTEGER. We reject any value above that bound rather than
 * silently returning a rounded number. The combination is equivalent to the
 * BigInt computation `BigInt(intPart) * 100n + BigInt(frac2)` for every value
 * in the accepted range (verified by example tests at the boundary).
 *
 * The returned value may be 0; callers that require positivity must check it.
 */
export function parseMoneyToPaise(text: string): number | null {
  const trimmed = text.trim();
  const m = MONEY_RE.exec(trimmed);
  if (!m) return null;

  const intPart = m[1];
  const fracPart = m[2] ?? "";
  const frac2 = (fracPart + "00").slice(0, 2);

  const rupees = Number(intPart);
  const paiseFrac = Number(frac2);
  if (!Number.isSafeInteger(rupees)) return null;

  const paise = rupees * 100 + paiseFrac;
  if (!Number.isSafeInteger(paise)) return null;
  // Explicit application bound: keep every amount exact and leave headroom so
  // that ledger-level aggregates stay within MAX_SAFE_INTEGER.
  if (paise > MAX_EXPENSE_PAISE) return null;
  return paise;
}

const INR_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format integer paise as an INR currency string, e.g. 123405 → "₹1,234.05".
 * Negative paise are formatted with a leading minus, e.g. -500 → "-₹5.00".
 */
export function formatPaise(paise: number): string {
  if (!Number.isInteger(paise)) {
    // Defensive: domain should only ever hand us integers.
    paise = Math.round(paise);
  }
  return INR_FORMAT.format(paise / 100);
}
