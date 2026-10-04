import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  exportDoc,
  importDoc,
  loadLedgerResult,
  saveLedger,
  getRecoveryCopy,
  clearRecoveryCopy,
  STORAGE_KEY,
  RECOVERY_KEY,
} from "./storage";
import { sampleLedger, emptyLedger, toPersistedDoc } from "../domain/ledger";

describe("importDoc (atomic, validating)", () => {
  it("round-trips a valid exported document", () => {
    const original = sampleLedger();
    const text = exportDoc(original);
    const result = importDoc(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(original);
    }
  });

  it("rejects invalid JSON without throwing (P9 — no partial apply)", () => {
    const result = importDoc("{ not valid json ");
    expect(result.ok).toBe(false);
  });

  it("rejects a well-formed JSON that fails schema validation", () => {
    const bad = JSON.stringify({ schemaVersion: 1, ledger: { currency: "USD", participants: [], expenses: [] } });
    const result = importDoc(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects wrong schema version", () => {
    const doc = JSON.parse(exportDoc(sampleLedger()));
    doc.schemaVersion = 42;
    const result = importDoc(JSON.stringify(doc));
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Storage recovery + save-failure behaviour (uses an in-memory localStorage).
// ---------------------------------------------------------------------------

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
}

describe("loadLedgerResult recovery", () => {
  const g = globalThis as unknown as { localStorage?: Storage };
  let original: Storage | undefined;

  beforeEach(() => {
    original = g.localStorage;
    g.localStorage = new MemoryStorage() as unknown as Storage;
  });

  afterEach(() => {
    if (original === undefined) delete g.localStorage;
    else g.localStorage = original;
  });

  it("reports 'empty' when nothing is stored", () => {
    const r = loadLedgerResult();
    expect(r.status).toBe("empty");
    expect(r.ledger).toEqual(emptyLedger());
  });

  it("reports 'loaded' for a valid stored document", () => {
    saveLedger(sampleLedger());
    const r = loadLedgerResult();
    expect(r.status).toBe("loaded");
    expect(r.ledger).toEqual(sampleLedger());
  });

  it("preserves corrupt data and reports 'recovered' instead of discarding it", () => {
    localStorage.setItem(STORAGE_KEY, "{ this is not valid json");
    const r = loadLedgerResult();
    expect(r.status).toBe("recovered");
    expect(r.ledger).toEqual(emptyLedger());
    // Original payload is still present AND copied to the recovery key.
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{ this is not valid json");
    expect(getRecoveryCopy()).toBe("{ this is not valid json");
  });

  it("treats schema-mismatched but well-formed JSON as recoverable", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, ledger: toPersistedDoc(sampleLedger()).ledger }),
    );
    const r = loadLedgerResult();
    expect(r.status).toBe("recovered");
    expect(getRecoveryCopy()).not.toBeNull();
  });

  it("clearRecoveryCopy removes the preserved payload", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    loadLedgerResult();
    expect(getRecoveryCopy()).not.toBeNull();
    clearRecoveryCopy();
    expect(getRecoveryCopy()).toBeNull();
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();
  });
});

describe("saveLedger result", () => {
  const g = globalThis as unknown as { localStorage?: Storage };
  let original: Storage | undefined;

  afterEach(() => {
    if (original === undefined) delete g.localStorage;
    else g.localStorage = original;
  });

  it("returns ok on success", () => {
    original = g.localStorage;
    g.localStorage = new MemoryStorage() as unknown as Storage;
    const r = saveLedger(sampleLedger());
    expect(r.ok).toBe(true);
  });

  it("surfaces an error when the write throws (e.g. quota exceeded)", () => {
    original = g.localStorage;
    const throwing = new MemoryStorage() as unknown as Storage;
    throwing.setItem = () => {
      throw new DOMException("QuotaExceededError");
    };
    g.localStorage = throwing;
    const r = saveLedger(sampleLedger());
    expect(r.ok).toBe(false);
  });

  it("reports unavailable when storage is absent", () => {
    original = g.localStorage;
    delete g.localStorage;
    const r = saveLedger(sampleLedger());
    expect(r.ok).toBe(false);
  });
});
