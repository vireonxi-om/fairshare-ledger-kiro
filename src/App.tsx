import { useEffect, useRef, useState } from "react";
import type { Ledger } from "./domain/types";
import { loadLedgerResult, saveLedger } from "./persistence/storage";
import { ParticipantsPanel } from "./ui/ParticipantsPanel";
import { ExpenseForm } from "./ui/ExpenseForm";
import { ExpenseList } from "./ui/ExpenseList";
import { Dashboard } from "./ui/Dashboard";
import { DataControls } from "./ui/DataControls";

export default function App() {
  // Load storage lazily exactly once per mount. Passing the function (not its
  // result) to useState means the loader runs only on the initial render, not
  // on every render as `useRef(loadLedgerResult())` did. React.StrictMode may
  // re-run this initializer in development, but each run is a pure read and the
  // first committed value is what we keep.
  const [initial] = useState(() => loadLedgerResult());
  const [ledger, setLedger] = useState<Ledger>(initial.ledger);
  const [status, setStatus] = useState("");

  // Identity of the ledger that is already persisted (or must not be
  // overwritten). Saves are gated on the ledger reference actually differing
  // from this, so neither a StrictMode effect replay nor a storageError state
  // update can trigger a spurious write. On a corrupt ("recovered") load the
  // baseline is the fallback empty ledger: we must NOT persist it over the
  // unreadable primary payload until the user makes a real change.
  const persistedLedger = useRef<Ledger>(initial.ledger);

  const [storageError, setStorageError] = useState<string | null>(
    initial.status === "recovered"
      ? "Saved data was unreadable and could not be loaded. Your previous data is preserved for recovery; it will not be overwritten until you make a change. Download the recovery data below, or Reset to discard."
      : initial.status === "unavailable"
        ? "Local storage is unavailable, so changes will not be saved in this browser."
        : null,
  );

  useEffect(() => {
    // Only persist when the ledger reference has actually changed from the
    // last persisted/baseline value. This is the single source of truth for
    // "should we save": it is independent of how many times the effect runs
    // (StrictMode double-invoke) and of storageError updates.
    if (ledger === persistedLedger.current) return;

    const result = saveLedger(ledger);
    if (result.ok) {
      persistedLedger.current = ledger;
      if (storageError) setStorageError(null);
    } else {
      // Preserve durable error semantics: surface the failure but do not
      // advance the persisted baseline, so a later successful save still runs.
      setStorageError(result.error);
    }
    // We intentionally depend only on `ledger`. storageError is read via the
    // closure but must not re-trigger the effect, or a cleared/updated error
    // would re-attempt a save that already succeeded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ₹
          </span>
          <div className="brand-text">
            <h1>FairShare Ledger</h1>
            <p>Exact paise splitting with a deterministic settlement plan.</p>
          </div>
        </div>
        <span className="local-badge" title="All data stays in this browser.">
          Local-only · no account
        </span>
      </header>

      {storageError && (
        <p className="alert" role="alert">
          {storageError}
        </p>
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>

      <main className="layout">
        <div className="col">
          <ParticipantsPanel ledger={ledger} onChange={setLedger} />
          <ExpenseForm ledger={ledger} onChange={setLedger} />
          <DataControls
            ledger={ledger}
            onReplace={setLedger}
            onStatus={setStatus}
            recoveryRaw={initial.corruptRaw ?? null}
          />
        </div>
        <div className="col">
          <Dashboard ledger={ledger} />
        </div>
        <ExpenseList ledger={ledger} onChange={setLedger} />
      </main>
    </div>
  );
}
