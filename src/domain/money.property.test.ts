import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseMoneyToPaise, formatPaise } from "./money";
import { MAX_EXPENSE_PAISE } from "./types";

/**
 * Property tests for exact money parsing/formatting — P1 (Req 2.2, 6.5).
 *
 * These are BOUNDED, RANDOMIZED checks: each property runs a fixed number of
 * fast-check-generated cases under an explicit seed, so a failure reproduces
 * deterministically. They are not formal proofs.
 *
 * The oracle is an INDEPENDENT BigInt reimplementation of the parse contract.
 * It never calls parseMoneyToPaise, so a disagreement signals a genuine
 * precision/behaviour bug rather than a circular self-check.
 */

// Explicit, reproducible seeds (one per property). Recorded in the evidence doc.
const SEED_PARSE_AGREES = 0x1a2b3c01;
const SEED_PARSE_REJECTS = 0x1a2b3c02;
const SEED_PARSE_OVERBOUND = 0x1a2b3c03;
const SEED_ROUNDTRIP = 0x1a2b3c04;
const RUNS = 500;

/**
 * Independent BigInt oracle for the accepted parse grammar:
 *   ^(\d+)(?:\.(\d{1,2}))?$
 * Returns exact paise as a bigint, or null if the text is not in the grammar.
 * Does NOT apply the MAX_EXPENSE_PAISE bound — the caller decides.
 */
function parseOracle(text: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  const frac2 = ((m[2] ?? "") + "00").slice(0, 2);
  return BigInt(m[1]) * 100n + BigInt(frac2);
}

/** Arbitrary producing well-formed amount strings within the accepted bound. */
function validAmountText(): fc.Arbitrary<string> {
  // Integer rupee part is bounded so that intPart*100 stays <= MAX_EXPENSE_PAISE
  // (MAX_EXPENSE_PAISE = 1e15 paise => 1e13 rupees). Keep a mix of magnitudes.
  const maxRupees = MAX_EXPENSE_PAISE / 100; // 1e13, exact integer
  const intPart = fc.oneof(
    fc.constant(0),
    fc.integer({ min: 0, max: 1_000_000 }),
    fc.integer({ min: 0, max: maxRupees - 1 }),
  );
  const frac = fc.oneof(
    fc.constant<string | null>(null), // no fractional part
    fc.integer({ min: 0, max: 9 }).map((d) => String(d)), // one digit
    fc.integer({ min: 0, max: 99 }).map((d) => String(d).padStart(2, "0")), // two digits
  );
  const pad = fc.tuple(
    fc.stringMatching(/^ {0,3}$/),
    fc.stringMatching(/^ {0,3}$/),
  );
  return fc
    .tuple(intPart, frac, pad)
    .map(([ip, fr, [lead, trail]]) =>
      fr === null ? `${lead}${ip}${trail}` : `${lead}${ip}.${fr}${trail}`,
    );
}

/** Arbitrary producing malformed / unsupported amount strings. */
function malformedAmountText(): fc.Arbitrary<string> {
  return fc.oneof(
    fc.constant(""),
    fc.constant(" "),
    fc.constant("."),
    fc.constant("1."),
    fc.constant(".5"),
    // signed values are not accepted
    fc.integer({ min: 1, max: 1_000_000 }).map((n) => `-${n}`),
    fc.integer({ min: 0, max: 1_000_000 }).map((n) => `+${n}`),
    // more than two fractional digits
    fc
      .tuple(fc.integer({ min: 0, max: 10_000 }), fc.integer({ min: 100, max: 999_999 }))
      .map(([a, b]) => `${a}.${b}`),
    // exponent notation
    fc.integer({ min: 1, max: 1000 }).map((n) => `${n}e2`),
    // thousands separators / currency symbols
    fc.constant("1,000"),
    fc.constant("₹5"),
    fc.constant("NaN"),
    fc.constant("Infinity"),
    // arbitrary non-numeric strings (filtered to not accidentally be valid)
    fc
      .string()
      .filter((s) => !/^\s*\d+(?:\.\d{1,2})?\s*$/.test(s)),
  );
}

describe("parseMoneyToPaise — properties (P1)", () => {
  it("agrees with an independent BigInt oracle for all accepted, in-bound inputs", () => {
    fc.assert(
      fc.property(validAmountText(), (text) => {
        const oracle = parseOracle(text);
        expect(oracle).not.toBeNull();
        const got = parseMoneyToPaise(text);
        if ((oracle as bigint) <= BigInt(MAX_EXPENSE_PAISE)) {
          // In-bound: must parse and equal the oracle exactly, as a safe int.
          expect(got).not.toBeNull();
          expect(Number.isSafeInteger(got as number)).toBe(true);
          expect(BigInt(got as number)).toBe(oracle as bigint);
        } else {
          // Over the explicit bound: must be rejected, never rounded.
          expect(got).toBeNull();
        }
      }),
      { seed: SEED_PARSE_AGREES, numRuns: RUNS },
    );
  });

  it("rejects malformed input, returning null (never a rounded number)", () => {
    fc.assert(
      fc.property(malformedAmountText(), (text) => {
        expect(parseMoneyToPaise(text)).toBeNull();
      }),
      { seed: SEED_PARSE_REJECTS, numRuns: RUNS },
    );
  });

  it("rejects over-bound and unsafe amounts instead of returning a rounded number", () => {
    // Generate whole-rupee amounts strictly above MAX_EXPENSE_PAISE, including
    // values whose paise representation exceeds Number.MAX_SAFE_INTEGER.
    const maxRupees = MAX_EXPENSE_PAISE / 100; // 1e13
    const overRupees = fc.oneof(
      fc.integer({ min: maxRupees + 1, max: maxRupees * 10 }),
      // Values whose *paise* (rupees*100) exceed MAX_SAFE_INTEGER (~9.007e15):
      fc.integer({ min: 90_071_992_547_410, max: Number.MAX_SAFE_INTEGER }),
    );
    fc.assert(
      fc.property(overRupees, (rupees) => {
        const got = parseMoneyToPaise(String(rupees));
        expect(got).toBeNull();
      }),
      { seed: SEED_PARSE_OVERBOUND, numRuns: RUNS },
    );
  });

  it("parse → format round-trips to the canonical INR string (P1)", () => {
    // Oracle: format the exact paise independently (BigInt rupee/paisa split)
    // and build the en-IN grouped string, then compare to formatPaise.
    const inrGroup = new Intl.NumberFormat("en-IN", {
      useGrouping: true,
      maximumFractionDigits: 0,
    });
    const oracleFormat = (paise: bigint): string => {
      const rupees = paise / 100n;
      const paisa = paise % 100n;
      return `₹${inrGroup.format(Number(rupees))}.${paisa
        .toString()
        .padStart(2, "0")}`;
    };
    fc.assert(
      fc.property(validAmountText(), (text) => {
        const oracle = parseOracle(text) as bigint;
        fc.pre(oracle <= BigInt(MAX_EXPENSE_PAISE));
        const paise = parseMoneyToPaise(text);
        expect(paise).not.toBeNull();
        expect(paise as number).toBeGreaterThanOrEqual(0);
        expect(formatPaise(paise as number)).toBe(oracleFormat(oracle));
      }),
      { seed: SEED_ROUNDTRIP, numRuns: RUNS },
    );
  });
});
