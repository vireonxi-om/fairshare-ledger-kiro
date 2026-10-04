import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { STORAGE_KEY, exportDoc, importDoc } from "./storage";
import {
  makeParticipants,
  participantIds,
  validLedger,
} from "../domain/ledger.arbitrary";
import { emptyLedger, sampleLedger } from "../domain/ledger";
import {
  type Ledger,
  type Result,
  MAX_EXPENSE_PAISE,
  MAX_LEDGER_TOTAL_PAISE,
  SCHEMA_VERSION,
} from "../domain/types";

/**
 * Property tests for safe import/export — Req 7.3/7.4 (roundtrip) and
 * P9 / Req 7.4–7.5 (rejection + no mutation).
 *
 * Bounded randomized checks under explicit seeds; not formal proofs.
 *
 * No-mutation note: importDoc / validatePersistedDoc never touch storage by
 * design. The rejection properties below install a mock `localStorage`
 * (vi.stubGlobal) with vi.fn spies, pre-seeded with a valid sentinel ledger,
 * and assert zero setItem/removeItem/clear calls plus byte-identical sentinel
 * and an unchanged in-memory ledger. These guard against regressions; they do
 * not prove anything about a real browser's localStorage.
 */

const SEED_ROUNDTRIP = 0x9a7e0001;
const SEED_REJECT_MALFORMED = 0x9a7e0002;
const SEED_REJECT_STRUCTURAL = 0x9a7e0003;
const SEED_REJECT_REFERENTIAL = 0x9a7e0004;
const RUNS = 500;

describe("export/import — roundtrip property (Req 7.3/7.4)", () => {
  it("importDoc(exportDoc(ledger)) returns ok with a ledger deep-equal to the original", () => {
    fc.assert(
      fc.property(validLedger(), (ledger) => {
        const text = exportDoc(ledger);
        const result = importDoc(text);
        expect(result.ok).toBe(true);
        if (result.ok) {
          // The generated ledgers are already canonical (trimmed names, no
          // duplicates), so a structural deep-equal is the right oracle.
          expect(result.value).toEqual(ledger);
        }
      }),
      { seed: SEED_ROUNDTRIP, numRuns: RUNS },
    );
  });
});

describe("import rejection — P9 / Req 7.4–7.5", () => {
  it("rejects non-JSON / malformed text", () => {
    const malformed = fc.oneof(
      fc.constant("{ not valid json"),
      fc.constant("]["),
      fc.constant("undefined"),
      fc.constant(""),
      // random strings that are not valid JSON
      fc.string().filter((s) => {
        try {
          JSON.parse(s);
          return false;
        } catch {
          return true;
        }
      }),
    );
    fc.assert(
      fc.property(malformed, (text) => {
        expect(importDoc(text).ok).toBe(false);
      }),
      { seed: SEED_REJECT_MALFORMED, numRuns: RUNS },
    );
  });

  it("rejects structurally invalid documents (wrong schema version, wrong shape, bad amounts)", () => {
    const structuralBad = fc.oneof(
      // wrong schema version
      validLedger().map((l) =>
        JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, ledger: l }),
      ),
      // wrong currency
      fc.constant(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ledger: { currency: "USD", participants: [], expenses: [] },
        }),
      ),
      // participants not an array
      fc.constant(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ledger: { currency: "INR", participants: {}, expenses: [] },
        }),
      ),
      // missing ledger entirely
      fc.constant(JSON.stringify({ schemaVersion: SCHEMA_VERSION })),
      // top-level is not an object
      fc.oneof(fc.constant("42"), fc.constant("[]"), fc.constant("null")),
      // non-positive / over-bound amount on an otherwise valid single expense
      fc.oneof(
        fc.constant(0),
        fc.constant(-1),
        fc.constant(MAX_EXPENSE_PAISE + 1),
        fc.constant(MAX_LEDGER_TOTAL_PAISE + 1),
      ).map((amt) =>
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ledger: {
            currency: "INR",
            participants: [
              { id: "p0", name: "A" },
              { id: "p1", name: "B" },
            ],
            expenses: [
              {
                id: "e0",
                title: "x",
                payerId: "p0",
                amountPaise: amt,
                dateISO: "2026-03-01",
                splitIds: ["p0", "p1"],
              },
            ],
          },
        }),
      ),
    );
    fc.assert(
      fc.property(structuralBad, (text) => {
        expect(importDoc(text).ok).toBe(false);
      }),
      { seed: SEED_REJECT_STRUCTURAL, numRuns: RUNS },
    );
  });

  it("rejects referentially invalid documents (dangling payer/split IDs, duplicate IDs)", () => {
    const referentialBad = fc.oneof(
      // payer id not among participants
      fc.constant(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ledger: {
            currency: "INR",
            participants: [{ id: "p0", name: "A" }, { id: "p1", name: "B" }],
            expenses: [
              {
                id: "e0",
                title: "x",
                payerId: "ghost",
                amountPaise: 100,
                dateISO: "2026-03-01",
                splitIds: ["p0"],
              },
            ],
          },
        }),
      ),
      // split id not among participants
      fc.constant(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ledger: {
            currency: "INR",
            participants: [{ id: "p0", name: "A" }, { id: "p1", name: "B" }],
            expenses: [
              {
                id: "e0",
                title: "x",
                payerId: "p0",
                amountPaise: 100,
                dateISO: "2026-03-01",
                splitIds: ["p0", "ghost"],
              },
            ],
          },
        }),
      ),
      // duplicate participant ids
      fc.constant(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ledger: {
            currency: "INR",
            participants: [{ id: "dup", name: "A" }, { id: "dup", name: "B" }],
            expenses: [],
          },
        }),
      ),
      // duplicate expense ids
      fc.constant(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ledger: {
            currency: "INR",
            participants: [{ id: "p0", name: "A" }, { id: "p1", name: "B" }],
            expenses: [
              { id: "e", title: "x", payerId: "p0", amountPaise: 100, dateISO: "2026-03-01", splitIds: ["p0"] },
              { id: "e", title: "y", payerId: "p1", amountPaise: 100, dateISO: "2026-03-02", splitIds: ["p1"] },
            ],
          },
        }),
      ),
      // empty splitIds
      fc.constant(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ledger: {
            currency: "INR",
            participants: [{ id: "p0", name: "A" }, { id: "p1", name: "B" }],
            expenses: [
              { id: "e0", title: "x", payerId: "p0", amountPaise: 100, dateISO: "2026-03-01", splitIds: [] },
            ],
          },
        }),
      ),
    );
    fc.assert(
      fc.property(referentialBad, (text) => {
        expect(importDoc(text).ok).toBe(false);
      }),
      { seed: SEED_REJECT_REFERENTIAL, numRuns: RUNS },
    );
  });
});

// Guard: emptyLedger is a valid roundtrip too (boundary — zero expenses).
describe("export/import — empty ledger boundary", () => {
  it("roundtrips an empty ledger", () => {
    const ledger = emptyLedger();
    const result = importDoc(exportDoc(ledger));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(ledger);
  });
});

// ---------------------------------------------------------------------------
// Rejected imports with a mock localStorage (P9 / Req 7.4–7.5)
// ---------------------------------------------------------------------------

const SEED_MUTATED_STRUCTURAL = 0x9a7e0010;
const SEED_MUTATED_REFERENTIAL = 0x9a7e0011;
const SEED_MALFORMED_TEXT = 0x9a7e0012;
const SEED_OVERFLOW = 0x9a7e0013;
const SEED_OVERFLOW_CONTROLS = 0x9a7e0014;

function createMockStorage(initial: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial));
  const getItem = vi.fn((key: string): string | null => store.get(key) ?? null);
  const setItem = vi.fn((key: string, value: string): void => {
    store.set(key, value);
  });
  const removeItem = vi.fn((key: string): void => {
    store.delete(key);
  });
  const clear = vi.fn((): void => {
    store.clear();
  });
  const api = {
    getItem,
    setItem,
    removeItem,
    clear,
    key: (index: number): string | null => [...store.keys()][index] ?? null,
    get length(): number {
      return store.size;
    },
  };
  return {
    store,
    api,
    getItem,
    setItem,
    removeItem,
    clear,
    resetSpies(): void {
      getItem.mockClear();
      setItem.mockClear();
      removeItem.mockClear();
      clear.mockClear();
    },
  };
}

type MockStorage = ReturnType<typeof createMockStorage>;
type ImportFn = (text: string) => Result<Ledger>;

interface DocLike {
  schemaVersion: unknown;
  ledger: {
    currency: unknown;
    participants: Array<Record<string, unknown>>;
    expenses: Array<Record<string, unknown>>;
  };
}

const SENTINEL = exportDoc(sampleLedger());

let mock: MockStorage;

beforeEach(() => {
  mock = createMockStorage({ [STORAGE_KEY]: SENTINEL });
  vi.stubGlobal("localStorage", mock.api);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Core per-case assertion: import must be rejected, make zero storage
 * writes/removals/clears, leave the sentinel bytes identical, and leave the
 * caller's in-memory ledger unchanged. Spies are reset for every case.
 */
function assertRejectedUntouched(
  importFn: ImportFn,
  text: string,
  current: Ledger,
): void {
  mock.resetSpies();
  const before: Ledger = structuredClone(current);
  const result = importFn(text);
  expect(result.ok).toBe(false);
  expect(mock.setItem).toHaveBeenCalledTimes(0);
  expect(mock.removeItem).toHaveBeenCalledTimes(0);
  expect(mock.clear).toHaveBeenCalledTimes(0);
  expect(mock.store.get(STORAGE_KEY)).toBe(SENTINEL);
  expect(mock.store.size).toBe(1);
  expect(current).toEqual(before);
}

function parseDoc(ledger: Ledger): DocLike {
  return JSON.parse(exportDoc(ledger)) as DocLike;
}

/** Append amount-1 pad expenses (payer = first participant) up to `n` total. */
function ensureExpenses(doc: DocLike, n: number): void {
  const first = doc.ledger.participants[0]?.id;
  if (typeof first !== "string") throw new Error("doc has no participants");
  while (doc.ledger.expenses.length < n) {
    const i = doc.ledger.expenses.length;
    doc.ledger.expenses.push({
      id: `pad_${i}`,
      title: "pad",
      payerId: first,
      amountPaise: 1,
      dateISO: "2026-03-01",
      splitIds: [first],
    });
  }
}

/** A ghost id that can never collide with any generated participant id. */
const ghostId = fc.stringMatching(/^ghost[a-z0-9]{0,6}$/).map((s) => `${s}~`);

/** Values that make `amountPaise` invalid (type, sign, integrality, bound). */
const badAmount: fc.Arbitrary<unknown> = fc.oneof(
  fc.constantFrom<unknown>(0, -1, 1.5, "100", null, true, [], {}, 2 ** 53),
  fc.integer({ min: -1_000_000, max: 0 }),
  fc.integer({ min: MAX_EXPENSE_PAISE + 1, max: MAX_LEDGER_TOTAL_PAISE }),
  fc.double({ min: 0.01, max: 1e6, noInteger: true, noNaN: true }),
);

/** Structural mutations of a valid exported doc; each is guaranteed invalid. */
const structuralMutatedText: fc.Arbitrary<string> = fc
  .tuple(
    validLedger(),
    fc.constantFrom(
      "schemaVersion",
      "schemaVersionType",
      "currency",
      "participantsNotArray",
      "expensesNotArray",
      "dropLedger",
      "badAmount",
      "dropExpenseField",
      "badDate",
      "blankName",
    ),
    fc.nat(),
    badAmount,
    fc.integer({ min: -5, max: 50 }),
    fc.constantFrom("id", "title", "payerId", "amountPaise", "dateISO", "splitIds"),
    fc.string({ maxLength: 4 }),
  )
  .map(([ledger, kind, sel, amount, version, field, junk]) => {
    const doc = parseDoc(ledger);
    switch (kind) {
      case "schemaVersion":
        doc.schemaVersion = version === SCHEMA_VERSION ? version + 1 : version;
        break;
      case "schemaVersionType":
        doc.schemaVersion = String(SCHEMA_VERSION);
        break;
      case "currency":
        doc.ledger.currency = junk === "INR" ? "USD" : `${junk}X`;
        break;
      case "participantsNotArray":
        doc.ledger.participants = {} as unknown as DocLike["ledger"]["participants"];
        break;
      case "expensesNotArray":
        doc.ledger.expenses = "none" as unknown as DocLike["ledger"]["expenses"];
        break;
      case "dropLedger":
        delete (doc as Partial<DocLike>).ledger;
        break;
      case "badAmount": {
        ensureExpenses(doc, 1);
        doc.ledger.expenses[sel % doc.ledger.expenses.length].amountPaise = amount;
        break;
      }
      case "dropExpenseField": {
        ensureExpenses(doc, 1);
        delete doc.ledger.expenses[sel % doc.ledger.expenses.length][field];
        break;
      }
      case "badDate": {
        ensureExpenses(doc, 1);
        doc.ledger.expenses[sel % doc.ledger.expenses.length].dateISO = `2026-13-${junk}`;
        break;
      }
      case "blankName":
        doc.ledger.participants[sel % doc.ledger.participants.length].name = "   ";
        break;
    }
    return JSON.stringify(doc);
  });

/** Referential mutations with generated ghost ids, duplicates, empty splits. */
const referentialMutatedText: fc.Arbitrary<string> = fc
  .tuple(
    validLedger(),
    fc.constantFrom(
      "ghostPayer",
      "ghostSplit",
      "dupParticipantId",
      "dupExpenseId",
      "dupSplitId",
      "emptySplit",
    ),
    fc.nat(),
    fc.nat(),
    ghostId,
  )
  .map(([ledger, kind, selA, selB, ghost]) => {
    const doc = parseDoc(ledger);
    const pick = (sel: number) => sel % doc.ledger.expenses.length;
    switch (kind) {
      case "ghostPayer": {
        ensureExpenses(doc, 1);
        doc.ledger.expenses[pick(selA)].payerId = ghost;
        break;
      }
      case "ghostSplit": {
        ensureExpenses(doc, 1);
        const e = doc.ledger.expenses[pick(selA)];
        const ids = e.splitIds as string[];
        ids.splice(selB % (ids.length + 1), 0, ghost);
        break;
      }
      case "dupParticipantId": {
        const ps = doc.ledger.participants;
        const a = selA % ps.length;
        const b = (a + 1 + (selB % (ps.length - 1))) % ps.length;
        ps[b].id = ps[a].id;
        break;
      }
      case "dupExpenseId": {
        ensureExpenses(doc, 2);
        const es = doc.ledger.expenses;
        const a = selA % es.length;
        const b = (a + 1 + (selB % (es.length - 1))) % es.length;
        es[b].id = es[a].id;
        break;
      }
      case "dupSplitId": {
        ensureExpenses(doc, 1);
        const ids = doc.ledger.expenses[pick(selA)].splitIds as string[];
        ids.splice(selB % (ids.length + 1), 0, ids[selB % ids.length]);
        break;
      }
      case "emptySplit": {
        ensureExpenses(doc, 1);
        doc.ledger.expenses[pick(selA)].splitIds = [];
        break;
      }
    }
    return JSON.stringify(doc);
  });

const notJson = (s: string): boolean => {
  try {
    JSON.parse(s);
    return false;
  } catch {
    return true;
  }
};

/** Truncated exports, trailing garbage and random non-JSON / non-doc text. */
const malformedText: fc.Arbitrary<string> = fc.oneof(
  fc
    .tuple(validLedger(), fc.nat())
    .map(([ledger, cut]) => {
      const text = exportDoc(ledger);
      return text.slice(0, cut % text.length); // proper prefix of an object: never valid JSON
    }),
  fc
    .tuple(validLedger(), fc.constantFrom("x", "}", ",", "{", "]", "\u0000"))
    .map(([ledger, tail]) => exportDoc(ledger) + tail),
  fc.string({ maxLength: 60 }).filter(notJson),
  fc.string({ unit: "binary", maxLength: 60 }).filter(notJson),
  // valid JSON that is not a persisted document (no schemaVersion 1)
  fc
    .jsonValue()
    .filter((v) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return true;
      return (v as Record<string, unknown>)["schemaVersion"] !== SCHEMA_VERSION;
    })
    .map((v) => JSON.stringify(v)),
);

/** Doc with the given participants and expense amounts; otherwise valid. */
function docFromAmounts(ids: readonly string[], amounts: readonly number[]): string {
  const n = ids.length;
  const doc = {
    schemaVersion: SCHEMA_VERSION,
    ledger: {
      currency: "INR",
      participants: makeParticipants(ids),
      expenses: amounts.map((amountPaise, i) => ({
        id: `e_${i}`,
        title: `Expense ${i}`,
        payerId: ids[i % n],
        amountPaise,
        dateISO: "2026-03-01",
        splitIds: ids.slice(0, 1 + (i % n)),
      })),
    },
  };
  return JSON.stringify(doc);
}

function bigSum(amounts: readonly number[]): bigint {
  return amounts.reduce((acc, a) => acc + BigInt(a), 0n);
}

const LIMIT = BigInt(MAX_LEDGER_TOTAL_PAISE);
const MAX_EXPENSE = BigInt(MAX_EXPENSE_PAISE);

/**
 * Amount lists where every amount is in [1, MAX_EXPENSE_PAISE] and the BigInt
 * sum exceeds MAX_LEDGER_TOTAL_PAISE. Random amounts first; if the sum is
 * still within the bound, MAX_EXPENSE_PAISE amounts are appended until it is
 * not (deterministic top-up, nothing is filtered away).
 */
const overflowAmounts: fc.Arbitrary<number[]> = fc
  .array(
    fc.oneof(
      fc.integer({ min: 1, max: MAX_EXPENSE_PAISE }),
      fc.integer({ min: 500_000_000_000_000, max: MAX_EXPENSE_PAISE }),
      fc.constant(MAX_EXPENSE_PAISE),
      fc.integer({ min: 1, max: 101 }),
    ),
    { minLength: 2, maxLength: 20 },
  )
  .map((amounts) => {
    const out = [...amounts];
    while (bigSum(out) <= LIMIT) out.push(MAX_EXPENSE_PAISE);
    return out;
  });

/** Lower every amount (never below 1) so the BigInt sum equals `target`. */
function reduceToTotal(amounts: readonly number[], target: bigint): number[] {
  let excess = bigSum(amounts) - target;
  const out = amounts.map((a) => BigInt(a));
  for (let i = 0; i < out.length && excess > 0n; i++) {
    const cut = excess < out[i] - 1n ? excess : out[i] - 1n;
    out[i] -= cut;
    excess -= cut;
  }
  if (excess !== 0n) throw new Error("cannot reduce amounts to target");
  return out.map((a) => Number(a));
}

const participantSet: fc.Arbitrary<string[]> = fc
  .integer({ min: 2, max: 12 })
  .chain((n) => participantIds(n));

describe("rejected imports leave a mock localStorage untouched (P9)", () => {
  it("mutated valid exports with structural faults are rejected without storage writes", () => {
    fc.assert(
      fc.property(validLedger(), structuralMutatedText, (current, text) => {
        assertRejectedUntouched(importDoc, text, current);
      }),
      { seed: SEED_MUTATED_STRUCTURAL, numRuns: RUNS },
    );
  });

  it("referentially invalid exports (ghost ids, duplicates, empty splits) are rejected without storage writes", () => {
    fc.assert(
      fc.property(validLedger(), referentialMutatedText, (current, text) => {
        assertRejectedUntouched(importDoc, text, current);
      }),
      { seed: SEED_MUTATED_REFERENTIAL, numRuns: RUNS },
    );
  });

  it("truncated / non-JSON / non-document text is rejected without storage writes", () => {
    fc.assert(
      fc.property(validLedger(), malformedText, (current, text) => {
        assertRejectedUntouched(importDoc, text, current);
      }),
      { seed: SEED_MALFORMED_TEXT, numRuns: RUNS },
    );
  });

  it("aggregate-overflow docs (each amount within bound, sum above MAX_LEDGER_TOTAL_PAISE) are rejected without storage writes", () => {
    fc.assert(
      fc.property(validLedger(), participantSet, overflowAmounts, (current, ids, amounts) => {
        // Preconditions: rejection must be attributable to the aggregate bound only.
        for (const a of amounts) {
          expect(Number.isSafeInteger(a)).toBe(true);
          expect(BigInt(a) >= 1n && BigInt(a) <= MAX_EXPENSE).toBe(true);
        }
        expect(bigSum(amounts) > LIMIT).toBe(true);
        assertRejectedUntouched(importDoc, docFromAmounts(ids, amounts), current);
      }),
      { seed: SEED_OVERFLOW, numRuns: RUNS },
    );
  });

  it("aggregate bound controls: sum == LIMIT accepted, LIMIT+1 rejected, reduced amounts accepted", () => {
    fc.assert(
      fc.property(participantSet, overflowAmounts, (ids, amounts) => {
        const extra = ids; // same participants for every variant
        // Over the bound: rejected.
        expect(bigSum(amounts) > LIMIT).toBe(true);
        expect(importDoc(docFromAmounts(extra, amounts)).ok).toBe(false);

        // Same doc with amounts reduced so the sum is exactly LIMIT: accepted.
        const exact = reduceToTotal(amounts, LIMIT);
        expect(bigSum(exact)).toBe(LIMIT);
        expect(exact.length).toBe(amounts.length);
        for (const a of exact) expect(BigInt(a) >= 1n && BigInt(a) <= MAX_EXPENSE).toBe(true);
        const accepted = importDoc(docFromAmounts(extra, exact));
        expect(accepted.ok).toBe(true);
        if (accepted.ok) {
          expect(accepted.value.expenses.map((e) => e.amountPaise)).toEqual(exact);
        }

        // Exactly LIMIT + 1 (one extra 1-paise expense): rejected.
        const plusOne = [...exact, 1];
        expect(bigSum(plusOne)).toBe(LIMIT + 1n);
        expect(importDoc(docFromAmounts(extra, plusOne)).ok).toBe(false);

        // Reduced further (LIMIT - 1 total, same count): accepted.
        const below = reduceToTotal(exact, LIMIT - 1n);
        expect(bigSum(below)).toBe(LIMIT - 1n);
        expect(importDoc(docFromAmounts(extra, below)).ok).toBe(true);
      }),
      { seed: SEED_OVERFLOW_CONTROLS, numRuns: RUNS },
    );
  });

  it("example: nine MAX_EXPENSE_PAISE expenses (== LIMIT) accepted, plus one more paise rejected", () => {
    const ids = ["p_1", "p_2"];
    const nine = Array.from({ length: 9 }, () => MAX_EXPENSE_PAISE);
    expect(bigSum(nine)).toBe(LIMIT);
    expect(importDoc(docFromAmounts(ids, nine)).ok).toBe(true);
    const over = [...nine, 1];
    expect(bigSum(over)).toBe(LIMIT + 1n);
    expect(importDoc(docFromAmounts(ids, over)).ok).toBe(false);
  });

  it("sanity: the harness detects storage writes (faulty importers fail the assertion)", () => {
    const current = sampleLedger();
    const bad = "{ broken";
    const faultySet: ImportFn = (t) => {
      const r = importDoc(t);
      localStorage.setItem(STORAGE_KEY, t);
      return r;
    };
    const faultyRemove: ImportFn = (t) => {
      const r = importDoc(t);
      localStorage.removeItem(STORAGE_KEY);
      return r;
    };
    const faultyClear: ImportFn = (t) => {
      const r = importDoc(t);
      localStorage.clear();
      return r;
    };
    const faultyBypassSpies: ImportFn = (t) => {
      const r = importDoc(t);
      mock.store.set(STORAGE_KEY, "tampered"); // changes bytes without using a spy
      return r;
    };
    const faultyAccepts: ImportFn = () => ({ ok: true, value: emptyLedger() });
    const faultyMutatesCaller: ImportFn = (t) => {
      current.participants.push({ id: "zz", name: "Zed" });
      return importDoc(t);
    };
    expect(() => assertRejectedUntouched(importDoc, bad, current)).not.toThrow();
    for (const faulty of [
      faultySet,
      faultyRemove,
      faultyClear,
      faultyBypassSpies,
      faultyAccepts,
      faultyMutatesCaller,
    ]) {
      mock.store.set(STORAGE_KEY, SENTINEL);
      expect(() => assertRejectedUntouched(faulty, bad, current)).toThrow();
    }
  });
});
