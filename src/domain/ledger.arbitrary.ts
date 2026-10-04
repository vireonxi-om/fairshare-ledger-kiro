/**
 * Shared fast-check arbitraries that build RAW, independently constructed
 * valid ledgers.
 *
 * Not a test file (no `.test.ts` suffix) so it is not collected as a suite;
 * it is imported by the balances/storage property tests and by
 * `ledger.arbitrary.test.ts`.
 *
 * Ledgers are assembled as plain `Ledger` objects WITHOUT calling the
 * production builders (`addParticipant` / `addExpense`), so the generator does
 * not share logic with the code under test. Validity is asserted, never
 * filtered: every generated ledger is checked with `validateLedger` and any
 * rejection throws (there is no `continue` / silent skipping anywhere).
 *
 * The only shaping step is a deterministic budget clamp on amounts so the
 * aggregate stays within MAX_LEDGER_TOTAL_PAISE while leaving >= 1 paise for
 * every remaining expense. It never drops an expense.
 */
import fc from "fast-check";
import {
  type Expense,
  type Ledger,
  type Participant,
  MAX_EXPENSE_PAISE,
  MAX_LEDGER_TOTAL_PAISE,
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
} from "./types";
import { validateLedger } from "./ledger";

const PER_EXPENSE_MID_MAX_PAISE = 50_000_000;
const MAX_EXPENSES = 12;

/**
 * Opaque participant-id generators. Mixed styles so that lexicographic order
 * frequently differs from creation order (e.g. `p_10` < `p_2`) and so that
 * mixed-case ids (`P3` vs `p_3`) appear.
 */
const numericStyleId = fc.nat({ max: 30 }).map((n) => `p_${n}`);
const mixedCaseStyleId = fc.oneof(
  fc.nat({ max: 30 }).map((n) => `p_${n}`),
  fc.nat({ max: 30 }).map((n) => `P${n}`),
  fc.nat({ max: 30 }).map((n) => `pX${n}`),
);
const randomStyleId = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,7}$/);

/** `count` unique opaque participant ids in a random (shuffled) order. */
export function participantIds(count: number): fc.Arbitrary<string[]> {
  return fc
    .constantFrom(numericStyleId, mixedCaseStyleId, randomStyleId)
    .chain((style) =>
      fc.uniqueArray(style, {
        minLength: count,
        maxLength: count,
      }),
    );
}

/** Build participants (case-insensitively unique names) for the given ids. */
export function makeParticipants(ids: readonly string[]): Participant[] {
  return ids.map((id, i) => ({
    id,
    name: i % 3 === 0 ? `PERSON ${i}` : i % 3 === 1 ? `person ${i}` : `Person ${i}`,
  }));
}

/** Amounts: remainder-dense small values, mid values, and boundaries. */
const rawAmountPaise: fc.Arbitrary<number> = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 1, max: 101 }) },
  { weight: 3, arbitrary: fc.integer({ min: 1, max: PER_EXPENSE_MID_MAX_PAISE }) },
  { weight: 2, arbitrary: fc.integer({ min: 1, max: MAX_EXPENSE_PAISE }) },
  {
    weight: 2,
    arbitrary: fc.constantFrom(
      1,
      2,
      3,
      MAX_EXPENSE_PAISE,
      MAX_EXPENSE_PAISE - 1,
      MAX_EXPENSE_PAISE - 2,
      Math.floor(MAX_EXPENSE_PAISE / 3),
      Math.floor(MAX_EXPENSE_PAISE / 7),
    ),
  },
);

interface ExpenseSpec {
  amountPaise: number;
  payerId: string;
  splitIds: string[];
  day: number;
}

function assemble(ids: readonly string[], specs: readonly ExpenseSpec[]): Ledger {
  const participants = makeParticipants(ids);
  const expenses: Expense[] = [];
  // All values here are <= 9e15 < MAX_SAFE_INTEGER, so plain arithmetic is exact.
  let remaining = MAX_LEDGER_TOTAL_PAISE;
  for (let j = 0; j < specs.length; j++) {
    const spec = specs[j];
    const stillToPlace = specs.length - 1 - j;
    const amountPaise = Math.max(1, Math.min(spec.amountPaise, remaining - stillToPlace));
    remaining -= amountPaise;
    expenses.push({
      id: `e_${j}`,
      title: `Expense ${j}`,
      payerId: spec.payerId,
      amountPaise,
      dateISO: `2026-03-${String(spec.day).padStart(2, "0")}`,
      splitIds: [...spec.splitIds],
    });
  }
  const ledger: Ledger = { currency: "INR", participants, expenses };
  if (validateLedger(ledger) === null) {
    throw new Error("generator produced a ledger that validateLedger rejects");
  }
  return ledger;
}

/** Arbitrary of valid ledgers with 2..12 participants and 0..12 expenses. */
export function validLedger(): fc.Arbitrary<Ledger> {
  return fc
    .integer({ min: MIN_PARTICIPANTS, max: MAX_PARTICIPANTS })
    .chain((count) =>
      participantIds(count).chain((ids) => {
        const spec: fc.Arbitrary<ExpenseSpec> = fc.record({
          amountPaise: rawAmountPaise,
          payerId: fc.constantFrom(...ids),
          splitIds: fc.oneof(
            { weight: 1, arbitrary: fc.shuffledSubarray(ids, { minLength: ids.length }) },
            { weight: 3, arbitrary: fc.shuffledSubarray(ids, { minLength: 1 }) },
          ),
          day: fc.integer({ min: 1, max: 28 }),
        });
        return fc
          .array(spec, { minLength: 0, maxLength: MAX_EXPENSES })
          .map((specs) => assemble(ids, specs));
      }),
    );
}

export { MAX_EXPENSE_PAISE };
