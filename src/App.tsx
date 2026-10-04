import { useEffect, useRef, useState } from "react";
import type { Ledger } from "./domain/types";
import { loadLedgerResult, saveLedger } from "./persistence/storage";
import { ParticipantsPanel } from "./ui/ParticipantsPanel";
import { ExpenseForm } from "./ui/ExpenseForm";
import { ExpenseList } from "./ui/ExpenseList";
import { Dashboard } from "./ui/Dashboard";
import { DataControls } from "./ui/DataControls";

export default function App() {
  const initial = useRef(loadLedgerResult());
  const [ledger, setLedger] = useState<Ledger>(initial.current.ledger);
  const [status, setStatus] = useState("");
  // When stored data was corrupt we must not immediately overwrite it with the
  // fallback empty ledger. Gate the first save until the user makes a change.
  const skipNextSave = useRef(initial.current.status === "recovered");
  const [storageError, setStorageError] = useState<string | null>(
    initial.current.status === "recovered"
      ? "Saved data was unreadable and could not be loaded. Your previous data is preserved for recovery; it will not be overwritten until you make a change. Use Export after fixing, or Reset to discard."
      : initial.current.status === "unavailable"
        ? "Local storage is unavailable, so changes will not be saved in this browser."
        : null,
  );

  useEffect(() => {
    if (skipNextSave.current) {
      // First effect run after a corrupt load: preserve the original payload.
      skipNextSave.current = false;
      return;
    }
    const result = saveLedger(ledger);
    if (!result.ok) {
      setStorageError(result.error);
    } else if (storageError) {
      setStorageError(null);
    }
  }, [ledger, storageError]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>FairShare Ledger</h1>
        <p>
          Split shared expenses with exact paise math and a deterministic
          settlement plan. Local-first — your data never leaves this browser.
        </p>
      </header>

      {storageError && (
        <p className="alert" role="alert">
          {storageError}
        </p>
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>

      <main className="grid">
        <ParticipantsPanel ledger={ledger} onChange={setLedger} />
        <ExpenseForm ledger={ledger} onChange={setLedger} />
        <Dashboard ledger={ledger} />
        <ExpenseList ledger={ledger} onChange={setLedger} />
        <DataControls
          ledger={ledger}
          onReplace={setLedger}
          onStatus={setStatus}
        />
      </main>
    </div>
  );
}
