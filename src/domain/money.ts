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

/**
 * Group the integer rupee part with the Indian digit-grouping convention
 * (en-IN): the first group is three digits, then groups of two. We format the
 * rupees integer directly rather than dividing paise by 100, so no float ever
 * touches the money value — the ₹ symbol and grouping are the only locale
 * concern. Intl.NumberFormat on an *integer* rupee count is exact for every
 * value within our aggregate bound (well under MAX_SAFE_INTEGER).
 */
const INR_RUPEE_GROUP = new Intl.NumberFormat("en-IN", {
  useGrouping: true,
  maximumFractionDigits: 0,
});

/**
 * Format integer paise as an INR currency string, e.g. 123405 → "₹1,234.05".
 * Negative paise are formatted with a leading minus, e.g. -500 → "-₹5.00".
 *
 * Exactness: the rupee and paisa components are derived with integer division
 * and remainder, never `paise / 100`. A float rupee value loses a paisa near
 * the aggregate bound (e.g. 8_999_999_999_999_999 paise would render as
 * ...999.98 instead of ...999.99 if divided as a Number). Splitting with
 * integer `Math.trunc`/remainder keeps the two-digit paisa exact for every
 * accepted value, including values at the aggregate limit and negatives.
 *
 * Rejects non-integer / non-finite input by throwing rather than silently
 * rounding, so a precision bug upstream surfaces instead of being masked.
 */
export function formatPaise(paise: number): string {
  if (!Number.isInteger(paise)) {
    throw new RangeError(
      `formatPaise expects an integer paise value, received ${paise}`,
    );
  }
  const negative = paise < 0;
  const abs = Math.abs(paise);
  // Integer split: exact for all safe integers (no division of the paise float).
  const rupees = Math.trunc(abs / 100);
  const paisaRemainder = abs - rupees * 100;
  const rupeeStr = INR_RUPEE_GROUP.format(rupees);
  const paisaStr = String(paisaRemainder).padStart(2, "0");
  return `${negative ? "-" : ""}₹${rupeeStr}.${paisaStr}`;
}
