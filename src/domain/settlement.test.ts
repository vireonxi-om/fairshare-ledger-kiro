import { describe, it, expect } from "vitest";
import type { Balance } from "./types";
import { planSettlement } from "./settlement";

function balances(nets: Record<string, number>): Map<string, Balance> {
  const m = new Map<string, Balance>();
  for (const [id, net] of Object.entries(nets)) {
    m.set(id, { paid: 0, share: 0, net });
  }
  return m;
}

function applyTransfers(
  nets: Record<string, number>,
  transfers: ReturnType<typeof planSettlement>,
): Record<string, number> {
  const result = { ...nets };
  for (const t of transfers) {
    result[t.fromId] += t.amountPaise; // debtor's negative net moves toward 0
    result[t.toId] -= t.amountPaise; // creditor's positive net moves toward 0
  }
  return result;
}

describe("planSettlement", () => {
  it("produces no transfers when everyone is settled", () => {
    expect(planSettlement(balances({ a: 0, b: 0 }))).toEqual([]);
  });

  it("clears a simple two-party balance (P6)", () => {
    const nets = { a: 600, b: -300, c: -300 };
    const transfers = planSettlement(balances(nets));
    const after = applyTransfers(nets, transfers);
    expect(after).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("every transfer is positive, no self-transfer, <= n-1 (P7)", () => {
    const nets = { a: 500, b: 300, c: -200, d: -600 };
    const n = Object.values(nets).filter((v) => v !== 0).length;
    const transfers = planSettlement(balances(nets));
    expect(transfers.length).toBeLessThanOrEqual(n - 1);
    for (const t of transfers) {
      expect(t.amountPaise).toBeGreaterThan(0);
      expect(Number.isInteger(t.amountPaise)).toBe(true);
      expect(t.fromId).not.toBe(t.toId);
    }
    expect(applyTransfers(nets, transfers)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it("is deterministic for the same balances (P8)", () => {
    const nets = { c: -200, a: 500, d: -600, b: 300 };
    const first = planSettlement(balances(nets));
    const second = planSettlement(balances(nets));
    expect(first).toEqual(second);
  });

  it("clears a remainder-driven uneven split", () => {
    // From a ₹900.01 three-way split: payer net +60001, others -30000/-30001.
    const nets = { a: -30001, b: -30000, c: 60001 };
    const transfers = planSettlement(balances(nets));
    expect(applyTransfers(nets, transfers)).toEqual({ a: 0, b: 0, c: 0 });
    expect(transfers.length).toBeLessThanOrEqual(2);
  });
});
