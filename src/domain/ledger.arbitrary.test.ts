import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validLedger } from "./ledger.arbitrary";
import { validateLedger } from "./ledger";
import { MAX_LEDGER_TOTAL_PAISE } from "./types";

/**
 * Guards the generator itself: every generated ledger must be valid (the
 * generator never silently skips or repairs), and the generated shape space
 * must actually contain the varied cases the other properties rely on.
 * Bounded randomized checks, explicit seeds; not proofs.
 */
const SEED_VALID = 0x1ed9e001;
const SEED_SHAPES = 0x1ed9e002;
const RUNS = 500;

describe("validLedger arbitrary", () => {
  it("every generated ledger passes validateLedger unchanged", () => {
    fc.assert(
      fc.property(validLedger(), (ledger) => {
        const validated = validateLedger(ledger);
        expect(validated).not.toBeNull();
        expect(validated).toEqual(ledger);
        let total = 0n;
        for (const e of ledger.expenses) {
          expect(e.amountPaise).toBeGreaterThanOrEqual(1);
          total += BigInt(e.amountPaise);
        }
        expect(total <= BigInt(MAX_LEDGER_TOTAL_PAISE)).toBe(true);
      }),
      { seed: SEED_VALID, numRuns: RUNS },
    );
  });

  it("covers varied shapes (sizes, id order, subsets, remainders, boundaries)", () => {
    const ledgers = fc.sample(validLedger(), { seed: SEED_SHAPES, numRuns: RUNS });
    const sizes = new Set(ledgers.map((l) => l.participants.length));
    expect(sizes.has(2)).toBe(true);
    expect(sizes.has(12)).toBe(true);

    const lexDiffers = ledgers.some((l) => {
      const ids = l.participants.map((p) => p.id);
      const sorted = [...ids].sort();
      return ids.some((id, i) => id !== sorted[i]);
    });
    expect(lexDiffers).toBe(true);

    const mixedCase = ledgers.some((l) =>
      l.participants.some((p) => p.id !== p.id.toLowerCase()),
    );
    expect(mixedCase).toBe(true);

    const partialSplit = ledgers.some((l) =>
      l.expenses.some((e) => e.splitIds.length < l.participants.length),
    );
    expect(partialSplit).toBe(true);

    const remainder = ledgers.some((l) =>
      l.expenses.some((e) => e.amountPaise % e.splitIds.length !== 0),
    );
    expect(remainder).toBe(true);

    const big = ledgers.some((l) => l.expenses.some((e) => e.amountPaise > 1e14));
    expect(big).toBe(true);
    expect(ledgers.some((l) => l.expenses.length === 0)).toBe(true);
  });
});
