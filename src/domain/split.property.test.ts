import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { splitEqualPaise } from "./split";
import { MAX_EXPENSE_PAISE, MAX_PARTICIPANTS } from "./types";

/**
 * Property tests for equal splitting — P2 (conservation), P3 (fairness bound),
 * P4 (determinism) — Req 3.1–3.4.
 *
 * Bounded randomized checks under explicit seeds, not formal proofs.
 *
 * The oracle recomputes the invariants from the raw amount and group size with
 * independent BigInt arithmetic; it never trusts splitEqualPaise's own output
 * as the source of truth for conservation/fairness.
 */

const SEED_CONSERVATION = 0x5b1c0001;
const SEED_FAIRNESS = 0x5b1c0002;
const SEED_REMAINDER_ORDER = 0x5b1c0003;
const SEED_DETERMINISM = 0x5b1c0004;
const RUNS = 500;

/** Distinct member ids, 1..MAX_PARTICIPANTS of them. */
function memberIds(): fc.Arbitrary<string[]> {
  return fc
    .uniqueArray(
      fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0),
      { minLength: 1, maxLength: MAX_PARTICIPANTS },
    );
}

/** Amounts across the whole accepted range, biased toward remainder-triggering
 * and boundary values. */
function amountPaise(): fc.Arbitrary<number> {
  return fc.oneof(
    fc.constant(0),
    fc.constant(1),
    fc.integer({ min: 0, max: 100 }), // tiny, remainder-dense
    fc.integer({ min: 0, max: 1_000_000 }),
    fc.integer({ min: 0, max: MAX_EXPENSE_PAISE }),
    fc.constant(MAX_EXPENSE_PAISE),
    fc.constant(MAX_EXPENSE_PAISE - 1),
  );
}

function sum(map: Map<string, number>): bigint {
  let t = 0n;
  for (const v of map.values()) t += BigInt(v);
  return t;
}

describe("splitEqualPaise — properties (P2, P3, P4)", () => {
  it("conserves every paisa: sum of shares === amount (P2)", () => {
    fc.assert(
      fc.property(amountPaise(), memberIds(), (amount, ids) => {
        const shares = splitEqualPaise(amount, ids);
        // Independent oracle: the sum MUST equal the input amount exactly.
        expect(sum(shares)).toBe(BigInt(amount));
        // Every participant receives a share.
        expect(shares.size).toBe(ids.length);
      }),
      { seed: SEED_CONSERVATION, numRuns: RUNS },
    );
  });

  it("fairness: max share − min share <= 1 paisa (P3)", () => {
    fc.assert(
      fc.property(amountPaise(), memberIds(), (amount, ids) => {
        const shares = splitEqualPaise(amount, ids);
        const vals = [...shares.values()];
        const max = vals.reduce((a, b) => (b > a ? b : a), vals[0]);
        const min = vals.reduce((a, b) => (b < a ? b : a), vals[0]);
        expect(max - min).toBeLessThanOrEqual(1);
      }),
      { seed: SEED_FAIRNESS, numRuns: RUNS },
    );
  });

  it("remainder goes to the first r ids in ascending sorted-ID order (P3)", () => {
    fc.assert(
      fc.property(amountPaise(), memberIds(), (amount, ids) => {
        const k = ids.length;
        const shares = splitEqualPaise(amount, ids);
        // Independent oracle for the per-id expected share.
        const base = Math.floor(amount / k);
        const remainder = amount % k;
        const sorted = [...ids].sort();
        for (let i = 0; i < sorted.length; i++) {
          const expected = base + (i < remainder ? 1 : 0);
          expect(shares.get(sorted[i])).toBe(expected);
        }
      }),
      { seed: SEED_REMAINDER_ORDER, numRuns: RUNS },
    );
  });

  it("is order-independent: shuffling member input order yields identical per-ID shares (P4)", () => {
    fc.assert(
      fc.property(
        amountPaise(),
        memberIds().chain((ids) =>
          // Produce a permutation of the same id set via shuffled subsequence.
          fc
            .shuffledSubarray(ids, { minLength: ids.length, maxLength: ids.length })
            .map((shuffled) => [ids, shuffled] as const),
        ),
        (amount, [ids, shuffled]) => {
          const a = splitEqualPaise(amount, ids);
          const b = splitEqualPaise(amount, shuffled);
          expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
        },
      ),
      { seed: SEED_DETERMINISM, numRuns: RUNS },
    );
  });
});
