/**
 * Versioned local persistence and safe import/export.
 *
 * This is the only module permitted to touch localStorage. Import validates the
 * entire document before returning a ledger; the caller applies it only on
 * success, so a failed import can never partially overwrite a valid ledger.
 */
import {
  type Ledger,
  type Result,
  err,
  ok,
} from "../domain/types";
import {
  emptyLedger,
  toPersistedDoc,
  validatePersistedDoc,
} from "../domain/ledger";

export const STORAGE_KEY = "fairshare.ledger.v1";
/** Where a corrupt/invalid payload is copied before we fall back to empty. */
export const RECOVERY_KEY = "fairshare.ledger.v1.corrupt";

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Outcome of a load attempt.
 *  - "empty": nothing was stored (or storage is unavailable); a fresh ledger.
 *  - "loaded": a valid stored ledger was read.
 *  - "recovered": stored data was present but corrupt/invalid; it has been
 *    copied to RECOVERY_KEY and an empty ledger is returned. The caller must
 *    NOT blindly overwrite STORAGE_KEY, so the original is preserved for the
 *    user to recover or discard.
 *  - "unavailable": storage could not be read at all.
 */
export type LoadStatus = "empty" | "loaded" | "recovered" | "unavailable";

export interface LoadResult {
  ledger: Ledger;
  status: LoadStatus;
  /** The raw corrupt payload, if any, so the UI can offer it for download. */
  corruptRaw?: string;
}

/**
 * Load the stored ledger without destroying unrecognised data.
 *
 * On corrupt/invalid stored data we copy the raw payload to RECOVERY_KEY and
 * report status "recovered" so the app shell can avoid overwriting the original
 * and can surface a clear error. Never throws.
 */
export function loadLedgerResult(): LoadResult {
  const storage = getStorage();
  if (!storage) return { ledger: emptyLedger(), status: "unavailable" };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ledger: emptyLedger(), status: "unavailable" };
  }
  if (raw === null) return { ledger: emptyLedger(), status: "empty" };

  let ledger: Ledger | null = null;
  try {
    ledger = validatePersistedDoc(JSON.parse(raw));
  } catch {
    ledger = null;
  }

  if (ledger) return { ledger, status: "loaded" };

  // Corrupt or schema-mismatched data present: preserve it for recovery rather
  // than silently discarding it on the next save.
  try {
    storage.setItem(RECOVERY_KEY, raw);
  } catch {
    // If we cannot even stash a recovery copy, still avoid overwriting the
    // original by leaving STORAGE_KEY untouched (the caller gates saves on
    // the "recovered" status).
  }
  return { ledger: emptyLedger(), status: "recovered", corruptRaw: raw };
}

/**
 * Backwards-compatible convenience wrapper that returns just the ledger. Note
 * this discards the recovery signal; prefer loadLedgerResult in app code.
 */
export function loadLedger(): Ledger {
  return loadLedgerResult().ledger;
}

/**
 * Persist the ledger under the versioned key. Returns a Result so callers can
 * surface quota/serialization failures instead of losing writes silently.
 */
export function saveLedger(ledger: Ledger): Result<void> {
  const storage = getStorage();
  if (!storage) return err("Storage is unavailable; changes are not saved.");
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(toPersistedDoc(ledger)));
    return ok(undefined);
  } catch {
    return err(
      "Could not save to local storage (it may be full or disabled). Your latest change is not persisted.",
    );
  }
}

/** Clear persisted ledger. */
export function clearStorage(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Return the preserved corrupt payload, if any, so the UI can offer it for download. */
export function getRecoveryCopy(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(RECOVERY_KEY);
  } catch {
    return null;
  }
}

/** Discard the preserved corrupt payload once the user has handled it. */
export function clearRecoveryCopy(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(RECOVERY_KEY);
  } catch {
    // ignore
  }
}

/** Serialize the ledger to a pretty-printed persisted document for export. */
export function exportDoc(ledger: Ledger): string {
  return JSON.stringify(toPersistedDoc(ledger), null, 2);
}

/**
 * Parse and fully validate an imported JSON document. Returns the validated
 * ledger on success or an error. This function performs NO storage writes, so
 * it cannot partially overwrite anything — the caller decides whether to apply.
 */
export function importDoc(text: string): Result<Ledger> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err("Import failed: the file is not valid JSON.");
  }
  const ledger = validatePersistedDoc(parsed);
  if (!ledger) {
    return err(
      "Import failed: the document does not match the expected schema version or structure.",
    );
  }
  return ok(ledger);
}
