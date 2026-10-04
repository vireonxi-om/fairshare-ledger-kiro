import { describe, it, expect } from "vitest";
import { splitEqualPaise } from "./split";
import { MAX_EXPENSE_PAISE } from "./types";

function sum(map: Map<string, number>): number {
  let t = 0;
  for (const v of map.values()) t += v;
  return t;
}

describe("splitEqualPaise", () => {
  it("splits evenly when divisible", () => {
    const s = splitEqualPaise(900, ["a", "b", "c"]);
    expect(s.get("a")).toBe(300);
    expect(s.get("b")).toBe(300);
    expect(s.get("c")).toBe(300);
  });

  it("distributes remainder to first ids by sorted order (P2, P3)", () => {
    // 100 / 3 = 33 r 1 → one extra paisa to the lexicographically-first id.
    const s = splitEqualPaise(100, ["c", "a", "b"]);
    expect(s.get("a")).toBe(34);
    expect(s.get("b")).toBe(33);
    expect(s.get("c")).toBe(33);
    expect(sum(s)).toBe(100); // conservation
    const vals = [...s.values()];
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1); // fairness bound
  });

  it("remainder of 2 goes to first two sorted ids", () => {
    const s = splitEqualPaise(902, ["a", "b", "c"]);
    expect(s.get("a")).toBe(301);
    expect(s.get("b")).toBe(301);
    expect(s.get("c")).toBe(300);
    expect(sum(s)).toBe(902);
  });

  it("is independent of input order (P4)", () => {
    const a = splitEqualPaise(100, ["x", "y", "z"]);
    const b = splitEqualPaise(100, ["z", "y", "x"]);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it("conserves amount for a sweep of amounts and group sizes (P2)", () => {
    for (let k = 1; k <= 12; k++) {
      const ids = Array.from({ length: k }, (_, i) => `p${i}`);
      for (const amount of [0, 1, 7, 100, 99999, 90001]) {
        expect(sum(splitEqualPaise(amount, ids))).toBe(amount);
      }
    }
  });

  it("handles single member", () => {
    const s = splitEqualPaise(777, ["only"]);
    expect(s.get("only")).toBe(777);
  });

  it("throws on invalid preconditions", () => {
    expect(() => splitEqualPaise(100, [])).toThrow();
    expect(() => splitEqualPaise(-1, ["a"])).toThrow();
    expect(() => splitEqualPaise(1.5, ["a"])).toThrow();
  });

  it("rejects duplicate member ids instead of silently collapsing them", () => {
    // Previously duplicates were collapsed by the Map, breaking conservation
    // (900 split across ["a","a","b"] summed to 600). Now it throws.
    expect(() => splitEqualPaise(900, ["a", "a", "b"])).toThrow(/duplicate/i);
  });

  it("rejects unsafe integers (Number.isInteger-but-not-safe) and over-bound amounts", () => {
    // 2^53 + 1 is an integer but not a *safe* integer.
    expect(() => splitEqualPaise(Number.MAX_SAFE_INTEGER + 2, ["a"])).toThrow();
    expect(() => splitEqualPaise(MAX_EXPENSE_PAISE + 1, ["a"])).toThrow();
  });

  it("accepts the exact MAX_EXPENSE_PAISE boundary", () => {
    const s = splitEqualPaise(MAX_EXPENSE_PAISE, ["a", "b"]);
    let sum = 0;
    for (const v of s.values()) sum += v;
    expect(sum).toBe(MAX_EXPENSE_PAISE);
  });
});
