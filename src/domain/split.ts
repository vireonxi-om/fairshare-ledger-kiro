/**
 * Deterministic equal splitting of an integer-paise amount.
 */

import { MAX_EXPENSE_PAISE } from "./types";

/**
 * Split `amountPaise` equally among `memberIds`.
 *
 * Each member gets a base share of floor(amount / k). The remainder
 * r = amount mod k is distributed one extra paisa at a time to the first r
 * members ordered by ascending (lexicographic) stable id. This makes the result
 * independent of input order and guarantees the shares sum exactly to the
 * amount, with any two shares differing by at most 1 paisa.
 *
 * Preconditions (enforced, not assumed):
 *  - amountPaise is a safe non-negative integer not exceeding MAX_EXPENSE_PAISE;
 *  - memberIds is non-empty and contains no duplicate ids.
 * Violations throw, because they indicate a programming/validation error
 * upstream rather than expected user input (which is validated in ledger.ts).
 */
export function splitEqualPaise(
  amountPaise: number,
  memberIds: string[],
): Map<string, number> {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 0) {
    throw new Error(
      "splitEqualPaise: amountPaise must be a safe non-negative integer",
    );
  }
  if (amountPaise > MAX_EXPENSE_PAISE) {
    throw new Error("splitEqualPaise: amountPaise exceeds the maximum bound");
  }
  const k = memberIds.length;
  if (k === 0) {
    throw new Error("splitEqualPaise: at least one member is required");
  }
  if (new Set(memberIds).size !== k) {
    throw new Error("splitEqualPaise: duplicate member ids are not allowed");
  }

  const sorted = [...memberIds].sort();
  const base = Math.floor(amountPaise / k);
  const remainder = amountPaise % k;

  const shares = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const extra = i < remainder ? 1 : 0;
    shares.set(sorted[i], base + extra);
  }
  return shares;
}
