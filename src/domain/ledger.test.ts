import { describe, it, expect } from "vitest";
import {
  addParticipant,
  addExpense,
  deleteParticipant,
  deleteExpense,
  emptyLedger,
  sampleLedger,
  toPersistedDoc,
  validateLedger,
  validatePersistedDoc,
} from "./ledger";
import { computeBalances } from "./balances";
import { MAX_EXPENSE_PAISE, MAX_LEDGER_TOTAL_PAISE } from "./types";

function base() {
  let l = emptyLedger();
  l = (addParticipant(l, "a", "Aarav") as { value: typeof l }).value;
  l = (addParticipant(l, "b", "Diya") as { value: typeof l }).value;
  return l;
}

describe("participant operations", () => {
  it("adds a valid participant", () => {
    const r = addParticipant(emptyLedger(), "a", "  Aarav  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.participants[0]).toEqual({ id: "a", name: "Aarav" });
  });

  it("rejects empty, too-long, duplicate, and over-max", () => {
    expect(addParticipant(emptyLedger(), "a", "   ").ok).toBe(false);
    expect(addParticipant(emptyLedger(), "a", "x".repeat(41)).ok).toBe(false);
    const two = base();
    expect(addParticipant(two, "c", "aarav").ok).toBe(false); // case-insensitive dup
    let full = emptyLedger();
    for (let i = 0; i < 12; i++) {
      full = (addParticipant(full, `p${i}`, `P${i}`) as { value: typeof full }).value;
    }
    expect(addParticipant(full, "p12", "Overflow").ok).toBe(false);
  });

  it("prevents deleting a referenced participant", () => {
    let l = base();
    l = (addExpense(l, "e1", {
      title: "X",
      payerId: "a",
      amountText: "100",
      dateISO: "2026-01-01",
      splitIds: ["a", "b"],
    }) as { value: typeof l }).value;
    expect(deleteParticipant(l, "a").ok).toBe(false);
  });

  it("allows deleting an unreferenced participant", () => {
    const l = base();
    const r = deleteParticipant(l, "a");
    expect(r.ok).toBe(true);
  });
});

describe("expense operations", () => {
  it("adds a valid expense and parses amount to paise", () => {
    const r = addExpense(base(), "e1", {
      title: "Dinner",
      payerId: "a",
      amountText: "123.45",
      dateISO: "2026-02-10",
      splitIds: ["a", "b"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.expenses[0].amountPaise).toBe(12345);
  });

  it("rejects bad amount, non-participant payer, empty split, bad date, empty title", () => {
    const l = base();
    const common = { payerId: "a", dateISO: "2026-01-01", splitIds: ["a", "b"] };
    expect(addExpense(l, "e", { ...common, title: "T", amountText: "0" }).ok).toBe(false);
    expect(addExpense(l, "e", { ...common, title: "T", amountText: "-5" }).ok).toBe(false);
    expect(addExpense(l, "e", { ...common, title: "T", amountText: "1.234" }).ok).toBe(false);
    expect(addExpense(l, "e", { ...common, title: "", amountText: "5" }).ok).toBe(false);
    expect(
      addExpense(l, "e", { title: "T", amountText: "5", payerId: "zzz", dateISO: "2026-01-01", splitIds: ["a"] }).ok,
    ).toBe(false);
    expect(
      addExpense(l, "e", { title: "T", amountText: "5", payerId: "a", dateISO: "2026-01-01", splitIds: [] }).ok,
    ).toBe(false);
    expect(
      addExpense(l, "e", { title: "T", amountText: "5", payerId: "a", dateISO: "2026-02-31", splitIds: ["a"] }).ok,
    ).toBe(false);
  });

  it("deletes an expense", () => {
    let l = base();
    l = (addExpense(l, "e1", {
      title: "X", payerId: "a", amountText: "100", dateISO: "2026-01-01", splitIds: ["a", "b"],
    }) as { value: typeof l }).value;
    const r = deleteExpense(l, "e1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.expenses).toHaveLength(0);
  });

  it("rejects an amount above the per-expense bound", () => {
    const overMax = String(MAX_EXPENSE_PAISE / 100 + 1); // one rupee over the cap
    const r = addExpense(base(), "e", {
      title: "Huge", payerId: "a", amountText: overMax, dateISO: "2026-01-01", splitIds: ["a", "b"],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an expense that would push the aggregate total past the bound (conservation guard)", () => {
    // Seed with amounts that are each individually valid but together approach
    // the ledger cap, then verify the next one is rejected.
    let l = base();
    const bigRupees = String(MAX_EXPENSE_PAISE / 100); // one max-sized expense
    // Add max-sized expenses until adding another would exceed the total cap.
    const perExpense = MAX_EXPENSE_PAISE;
    const allowed = Math.floor(MAX_LEDGER_TOTAL_PAISE / perExpense);
    for (let i = 0; i < allowed; i++) {
      const r = addExpense(l, `e${i}`, {
        title: `E${i}`, payerId: "a", amountText: bigRupees, dateISO: "2026-01-01", splitIds: ["a", "b"],
      });
      expect(r.ok).toBe(true);
      if (r.ok) l = r.value;
    }
    // One more max-sized expense must now be rejected by the aggregate guard.
    const over = addExpense(l, "e_over", {
      title: "Over", payerId: "a", amountText: bigRupees, dateISO: "2026-01-01", splitIds: ["a", "b"],
    });
    expect(over.ok).toBe(false);
  });
});

describe("validation", () => {
  it("accepts the sample ledger and keeps balances summing to zero", () => {
    const sample = sampleLedger();
    expect(validateLedger(sample)).not.toBeNull();
    let total = 0;
    for (const v of computeBalances(sample).values()) total += v.net;
    expect(total).toBe(0);
  });

  it("rejects structurally invalid ledgers", () => {
    expect(validateLedger(null)).toBeNull();
    expect(validateLedger({})).toBeNull();
    expect(validateLedger({ currency: "USD", participants: [], expenses: [] })).toBeNull();
    // Expense referencing a non-existent payer.
    expect(
      validateLedger({
        currency: "INR",
        participants: [{ id: "a", name: "A" }],
        expenses: [{ id: "e", title: "T", payerId: "ghost", amountPaise: 100, dateISO: "2026-01-01", splitIds: ["a"] }],
      }),
    ).toBeNull();
    // Non-integer / non-positive amount.
    expect(
      validateLedger({
        currency: "INR",
        participants: [{ id: "a", name: "A" }],
        expenses: [{ id: "e", title: "T", payerId: "a", amountPaise: 1.5, dateISO: "2026-01-01", splitIds: ["a"] }],
      }),
    ).toBeNull();
  });

  it("validatePersistedDoc enforces schema version", () => {
    const doc = toPersistedDoc(sampleLedger());
    expect(validatePersistedDoc(doc)).not.toBeNull();
    expect(validatePersistedDoc({ ...doc, schemaVersion: 999 })).toBeNull();
    expect(validatePersistedDoc({ schemaVersion: 1 })).toBeNull();
  });

  it("rejects a document whose aggregate total would overflow exact-integer math", () => {
    // Two amounts that are each individually valid but sum past the ledger cap.
    const half = MAX_EXPENSE_PAISE; // each at the per-expense cap
    const count = Math.floor(MAX_LEDGER_TOTAL_PAISE / half) + 1; // one too many
    const expenses = Array.from({ length: count }, (_, i) => ({
      id: `e${i}`,
      title: "T",
      payerId: "a",
      amountPaise: half,
      dateISO: "2026-01-01",
      splitIds: ["a"],
    }));
    const bad = {
      currency: "INR",
      participants: [{ id: "a", name: "A" }],
      expenses,
    };
    expect(validateLedger(bad)).toBeNull();
  });

  it("rejects an expense amount above the per-expense bound", () => {
    const bad = {
      currency: "INR",
      participants: [{ id: "a", name: "A" }],
      expenses: [
        { id: "e", title: "T", payerId: "a", amountPaise: MAX_EXPENSE_PAISE + 1, dateISO: "2026-01-01", splitIds: ["a"] },
      ],
    };
    expect(validateLedger(bad)).toBeNull();
  });
});
