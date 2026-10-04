/**
 * Core domain types for FairShare Ledger.
 *
 * Money is always represented as integer paise (1 INR = 100 paise). No
 * floating-point money arithmetic occurs anywhere in the domain layer.
 */

export type Currency = "INR";

export interface Participant {
  /** Stable opaque identifier, assigned once and never reused. */
  id: string;
  /** Trimmed display name, 1–40 characters. */
  name: string;
}

export interface Expense {
  /** Stable opaque identifier. */
  id: string;
  /** Trimmed title, 1–60 characters. */
  title: string;
  /** Participant id of the payer. Must reference an existing participant. */
  payerId: string;
  /** Positive integer amount in paise. */
  amountPaise: number;
  /** ISO calendar date "YYYY-MM-DD". */
  dateISO: string;
  /** Non-empty subset of participant ids who share this expense. */
  splitIds: string[];
}

export interface Ledger {
  currency: Currency;
  participants: Participant[];
  expenses: Expense[];
}

/** Current persisted-schema version. Bump when the shape changes. */
export const SCHEMA_VERSION = 1 as const;

export interface PersistedDoc {
  schemaVersion: number;
  ledger: Ledger;
}

/** Per-participant balance figures, all in paise. */
export interface Balance {
  /** Total paid across expenses this participant funded. */
  paid: number;
  /** Total share assigned across all expenses. */
  share: number;
  /** paid − share. Positive = owed money; negative = owes money. */
  net: number;
}

/** A single settlement transfer. amountPaise is a positive integer. */
export interface Transfer {
  fromId: string;
  toId: string;
  amountPaise: number;
}

/** Discriminated result used for expected validation outcomes. */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: string): Result<T> {
  return { ok: false, error };
}

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 12;
export const MAX_NAME_LEN = 40;
export const MAX_TITLE_LEN = 60;

/**
 * Explicit money bounds (in paise).
 *
 * JavaScript numbers are exact integers only up to Number.MAX_SAFE_INTEGER
 * (9_007_199_254_740_991). Beyond that, integer addition silently loses
 * precision, which would break the conservation invariant (sum of nets === 0)
 * even when every individual expense is independently representable.
 *
 * To keep *all* ledger-level aggregates (totals, per-participant paid/share,
 * nets, and settlement transfers) exact, we cap a single expense amount at
 * MAX_EXPENSE_PAISE and the sum of all expense amounts at MAX_LEDGER_TOTAL_PAISE.
 * Both bounds sit comfortably below MAX_SAFE_INTEGER with headroom for the
 * MAX_PARTICIPANTS multiplier used when accumulating per-participant shares.
 *
 * MAX_EXPENSE_PAISE = 1e15 paise = ₹10,000,000,000,000 (₹10 trillion) per
 * expense, which is far beyond any realistic shared-expense use case while
 * leaving ~9x headroom under MAX_SAFE_INTEGER for a single value.
 *
 * MAX_LEDGER_TOTAL_PAISE = 9e15 paise keeps the running total (and therefore
 * every derived aggregate, since no aggregate can exceed the grand total)
 * strictly below MAX_SAFE_INTEGER. 9e15 < 9_007_199_254_740_991.
 */
export const MAX_EXPENSE_PAISE = 1_000_000_000_000_000; // 1e15
export const MAX_LEDGER_TOTAL_PAISE = 9_000_000_000_000_000; // 9e15 < MAX_SAFE_INTEGER
