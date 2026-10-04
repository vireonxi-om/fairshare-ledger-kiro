import { describe, it, expect } from "vitest";
import { parseMoneyToPaise, formatPaise } from "./money";
import { MAX_EXPENSE_PAISE } from "./types";

/**
 * Independent BigInt reference for the parse contract. Mirrors the regex but
 * computes paise with arbitrary-precision integers, so any disagreement with
 * the production Number-based parser signals a precision bug.
 */
function parseOracle(text: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  const frac2 = ((m[2] ?? "") + "00").slice(0, 2);
  return BigInt(m[1]) * 100n + BigInt(frac2);
}

describe("parseMoneyToPaise", () => {
  it("parses integers to paise", () => {
    expect(parseMoneyToPaise("0")).toBe(0);
    expect(parseMoneyToPaise("1")).toBe(100);
    expect(parseMoneyToPaise("1234")).toBe(123400);
  });

  it("parses one and two fractional digits exactly", () => {
    expect(parseMoneyToPaise("10.5")).toBe(1050);
    expect(parseMoneyToPaise("10.50")).toBe(1050);
    expect(parseMoneyToPaise("10.05")).toBe(1005);
    expect(parseMoneyToPaise("1234.05")).toBe(123405);
    // Classic float trap: 0.1 + 0.2 style amounts stay exact.
    expect(parseMoneyToPaise("0.10")).toBe(10);
    expect(parseMoneyToPaise("0.20")).toBe(20);
  });

  it("trims surrounding whitespace", () => {
    expect(parseMoneyToPaise("  12.34  ")).toBe(1234);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", " ", "-1", "+1", "1.", ".5", "1.234", "1e2", "abc", "1,000", "₹5", "NaN"]) {
      expect(parseMoneyToPaise(bad)).toBeNull();
    }
  });

  it("agrees with an independent BigInt oracle across the accepted range (P1)", () => {
    const samples = [
      "0",
      "0.01",
      "0.1",
      "1",
      "9.99",
      "1234.05",
      "99999999.99",
      "1000000000.00",
      String(MAX_EXPENSE_PAISE / 100), // exact max as whole rupees
      (MAX_EXPENSE_PAISE / 100 - 1).toString() + ".99",
    ];
    for (const s of samples) {
      const got = parseMoneyToPaise(s);
      const oracle = parseOracle(s);
      expect(oracle).not.toBeNull();
      // Only compare where the value is within the accepted (bounded) range.
      if ((oracle as bigint) <= BigInt(MAX_EXPENSE_PAISE)) {
        expect(got).not.toBeNull();
        expect(BigInt(got as number)).toBe(oracle);
        expect(Number.isSafeInteger(got as number)).toBe(true);
      }
    }
  });

  it("accepts the exact MAX_EXPENSE_PAISE boundary and rejects just above it", () => {
    const maxRupees = MAX_EXPENSE_PAISE / 100; // 1e13, an integer
    expect(parseMoneyToPaise(String(maxRupees))).toBe(MAX_EXPENSE_PAISE);
    // One paisa over the bound must be rejected, not silently rounded.
    expect(parseMoneyToPaise(String(maxRupees) + ".01")).toBeNull();
    expect(parseMoneyToPaise(String(maxRupees + 1))).toBeNull();
  });

  it("rejects values beyond MAX_SAFE_INTEGER rather than returning a rounded number", () => {
    // 90071992547409.92 paise = 9007199254740992 > MAX_SAFE_INTEGER.
    expect(parseMoneyToPaise("90071992547409.92")).toBeNull();
    // This whole-rupee value is also well past the explicit bound.
    expect(parseMoneyToPaise("99999999999999.99")).toBeNull();
  });
});

describe("formatPaise", () => {
  it("formats paise as INR with two decimals", () => {
    expect(formatPaise(123405)).toBe("₹1,234.05");
    expect(formatPaise(0)).toBe("₹0.00");
    expect(formatPaise(5)).toBe("₹0.05");
    expect(formatPaise(100)).toBe("₹1.00");
  });

  it("formats negative paise with a leading minus", () => {
    expect(formatPaise(-500)).toBe("-₹5.00");
  });

  it("round-trips parse → format for canonical inputs (property P1 by example)", () => {
    const cases: Array<[string, string]> = [
      ["0", "₹0.00"],
      ["10", "₹10.00"],
      ["10.5", "₹10.50"],
      ["1234.05", "₹1,234.05"],
    ];
    for (const [input, expected] of cases) {
      const paise = parseMoneyToPaise(input);
      expect(paise).not.toBeNull();
      expect(formatPaise(paise as number)).toBe(expected);
    }
  });
});
