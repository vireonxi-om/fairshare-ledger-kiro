import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Balance } from "./types";
import { planSettlement } from "./settlement";
import { MAX_PARTICIPANTS } from "./types";

/**
 * Property tests for settlement — P6 (clearing), P7 (transfer validity),
 * P8 (determinism) — Req 5.1–5.5.
 *
 * Bounded randomized checks under explicit seeds; not formal proofs.
 *
 * Independence: the clearing oracle applies the planned transfers to a COPY of
 * the net balances itself (BigInt) and checks every balance reaches zero. It
 * does not call planSettlement's internals — it only consumes its output and
 * verifies the mathematical post-condition.
 */

const SEED_CLEARS = 0x5e77e001;
const SEED_VALIDITY = 0x5e77e002;
const SEED_DETERMINISM = 0x5e77e003;
const RUNS = 500;

/**
 * Generate a zero-sum set of integer nets for 2..12 participants. We draw k−1
 * independent nets and set the last so the total is exactly zero, mirroring the
 * invariant that computeBalances guarantees (P5). Values are bounded well
 * within the safe-integer range.
 */
function zeroSumNets(): fc.Arbitrary<Array<[string, number]>> {
  return fc
    .integer({ min: 2, max: MAX_PARTICIPANTS })
    .chain((k) =>
      fc
        .array(fc.integer({ min: -1_000_000, max: 1_000_000 }), {
          minLength: k - 1,
          maxLength: k - 1,
        })
        .map((head) => {
          const last = -head.reduce((a, b) => a + b, 0);
          const nets = [...head, last];
          // Stable, distinct ids. Use varied prefixes so sort order is exercised.
          return nets.map(
            (net, i) => [`id_${String(i).padStart(2, "0")}`, net] as [string, number],
          );
        }),
    );
}

function toBalanceMap(entries: Array<[string, number]>): Map<string, Balance> {
  const m = new Map<string, Balance>();
  for (const [id, net] of entries) m.set(id, { paid: 0, share: 0, net });
  return m;
}

describe("planSettlement — properties (P6, P7, P8)", () => {
  it("applying planned transfers clears every balance to exactly zero (P6)", () => {
    fc.assert(
      fc.property(zeroSumNets(), (entries) => {
        const plan = planSettlement(toBalanceMap(entries));
        // Independent simulation: debtor net moves up, creditor net moves down.
        const sim = new Map<string, bigint>();
        for (const [id, net] of entries) sim.set(id, BigInt(net));
        for (const t of plan) {
          sim.set(t.fromId, (sim.get(t.fromId) as bigint) + BigInt(t.amountPaise));
          sim.set(t.toId, (sim.get(t.toId) as bigint) - BigInt(t.amountPaise));
        }
        for (const v of sim.values()) expect(v).toBe(0n);
      }),
      { seed: SEED_CLEARS, numRuns: RUNS },
    );
  });

  it("every transfer is positive, no self-transfer, count <= n-1 (P7)", () => {
    fc.assert(
      fc.property(zeroSumNets(), (entries) => {
        const nonZero = entries.filter(([, net]) => net !== 0).length;
        const plan = planSettlement(toBalanceMap(entries));
        expect(plan.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
        for (const t of plan) {
          expect(Number.isSafeInteger(t.amountPaise)).toBe(true);
          expect(t.amountPaise).toBeGreaterThan(0);
          expect(t.fromId).not.toBe(t.toId);
        }
      }),
      { seed: SEED_VALIDITY, numRuns: RUNS },
    );
  });

  it("same balances in different input/map orderings yield the identical ordered plan (P8)", () => {
    fc.assert(
      fc.property(
        zeroSumNets().chain((entries) =>
          fc
            .shuffledSubarray(entries, {
              minLength: entries.length,
              maxLength: entries.length,
            })
            .map((shuffled) => [entries, shuffled] as const),
        ),
        ([original, shuffled]) => {
          const planA = planSettlement(toBalanceMap(original));
          const planB = planSettlement(toBalanceMap(shuffled));
          // Deterministic: identical ordered plan regardless of insertion order.
          expect(planB).toEqual(planA);
        },
      ),
      { seed: SEED_DETERMINISM, numRuns: RUNS },
    );
  });
});
