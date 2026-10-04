import { useRef, useState } from "react";
import type { Ledger } from "../domain/types";
import { emptyLedger, sampleLedger } from "../domain/ledger";
import { exportDoc, importDoc } from "../persistence/storage";

interface Props {
  ledger: Ledger;
  onReplace: (next: Ledger) => void;
  onStatus: (message: string) => void;
  /**
   * The raw, unparsed payload preserved when stored data was unreadable, if
   * any. When present we offer a "Download recovery data" control so the user
   * can retrieve the exact original bytes — Export JSON would only serialise
   * the empty fallback ledger, not the corrupt original.
   */
  recoveryRaw?: string | null;
}

/** Trigger a client-side download of `text` as `filename`. */
function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataControls({
  ledger,
  onReplace,
  onStatus,
  recoveryRaw = null,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    const text = exportDoc(ledger);
    downloadText(text, "fairshare-ledger.json", "application/json");
    onStatus("Ledger exported.");
  }

  function handleDownloadRecovery() {
    if (!recoveryRaw) return;
    // Preserve the exact original bytes; do not re-serialise or validate.
    downloadText(
      recoveryRaw,
      "fairshare-recovery.json",
      "application/octet-stream",
    );
    onStatus("Recovery data downloaded.");
  }

  async function handleImportFile(file: File) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      // Reading the file itself failed (permissions, I/O, revoked blob, etc.).
      // Surface an accessible error; the current ledger is left untouched.
      setError(
        "Import failed: the selected file could not be read. Please try choosing the file again.",
      );
      return;
    }
    const result = importDoc(text);
    if (!result.ok) {
      // Current ledger is left untouched — import is atomic.
      setError(result.error);
      return;
    }
    setError(null);
    onReplace(result.value);
    onStatus("Ledger imported successfully.");
  }

  function handleSample() {
    if (
      window.confirm(
        "Load sample data? This replaces your current ledger.",
      )
    ) {
      setError(null);
      onReplace(sampleLedger());
      onStatus("Sample ledger loaded.");
    }
  }

  function handleReset() {
    if (
      window.confirm(
        "Reset the ledger? This permanently clears all participants and expenses.",
      )
    ) {
      setError(null);
      onReplace(emptyLedger());
      onStatus("Ledger reset.");
    }
  }

  return (
    <section className="card" aria-labelledby="data-heading">
      <h2 id="data-heading">Save, import &amp; reset</h2>
      <div className="row">
        <button type="button" onClick={handleExport}>
          Export JSON
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <button type="button" onClick={handleSample}>
          Load sample
        </button>
        <button type="button" className="danger" onClick={handleReset}>
          Reset
        </button>
      </div>
      {recoveryRaw && (
        <div className="row">
          <button type="button" onClick={handleDownloadRecovery}>
            Download recovery data
          </button>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        aria-label="Import ledger JSON file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <p className="muted">
        Data is stored only in this browser. Nothing is uploaded. Import
        validates the whole file first and never partially overwrites a valid
        ledger.
      </p>
    </section>
  );
}
