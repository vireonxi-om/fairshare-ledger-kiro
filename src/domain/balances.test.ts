import { describe, it, expect } from "vitest";
import type { Ledger } from "./types";
import { computeBalances, totalSpentPaise } from "./balances";

function ledgerOf(partial: Partial<Ledger>): Ledger {
  return {
    currency: "INR",
    participants: partial.participants ?? [],
    expenses: partial.expenses ?? [],
  };
}

const threePeople = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
];

describe("computeBalances", () => {
  it("computes paid, share, net for a simple expense", () => {
    const ledger = ledgerOf({
      participants: threePeople,
      expenses: [
        {
          id: "e1",
          title: "Dinner",
          payerId: "a",
          amountPaise: 900,
          dateISO: "2026-01-01",
          splitIds: ["a", "b", "c"],
        },
      ],
    });
    const b = computeBalances(ledger);
    expect(b.get("a")).toEqual({ paid: 900, share: 300, net: 600 });
    expect(b.get("b")).toEqual({ paid: 0, share: 300, net: -300 });
    expect(b.get("c")).toEqual({ paid: 0, share: 300, net: -300 });
  });

  it("sum of nets is exactly zero, including remainder cases (P5)", () => {
    const ledger = ledgerOf({
      participants: threePeople,
      expenses: [
        { id: "e1", title: "x", payerId: "a", amountPaise: 100, dateISO: "2026-01-01", splitIds: ["a", "b", "c"] },
        { id: "e2", title: "y", payerId: "b", amountPaise: 90001, dateISO: "2026-01-02", splitIds: ["a", "b", "c"] },
        { id: "e3", title: "z", payerId: "c", amountPaise: 45050, dateISO: "2026-01-03", splitIds: ["b", "c"] },
      ],
    });
    const b = computeBalances(ledger);
    let total = 0;
    for (const v of b.values()) total += v.net;
    expect(total).toBe(0);
  });

  it("includes zero entries for inactive participants", () => {
    const ledger = ledgerOf({ participants: threePeople, expenses: [] });
    const b = computeBalances(ledger);
    expect(b.get("a")).toEqual({ paid: 0, share: 0, net: 0 });
  });
});

describe("totalSpentPaise", () => {
  it("sums expense amounts", () => {
    const ledger = ledgerOf({
      participants: threePeople,
      expenses: [
        { id: "e1", title: "x", payerId: "a", amountPaise: 100, dateISO: "2026-01-01", splitIds: ["a"] },
        { id: "e2", title: "y", payerId: "b", amountPaise: 250, dateISO: "2026-01-02", splitIds: ["b"] },
      ],
    });
    expect(totalSpentPaise(ledger)).toBe(350);
  });
});
