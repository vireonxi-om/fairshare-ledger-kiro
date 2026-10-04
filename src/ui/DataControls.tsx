import { useRef, useState } from "react";
import type { Ledger } from "../domain/types";
import { emptyLedger, sampleLedger } from "../domain/ledger";
import { exportDoc, importDoc } from "../persistence/storage";

interface Props {
  ledger: Ledger;
  onReplace: (next: Ledger) => void;
  onStatus: (message: string) => void;
}

export function DataControls({ ledger, onReplace, onStatus }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    const text = exportDoc(ledger);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fairshare-ledger.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onStatus("Ledger exported.");
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
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
    <section className="card span-2" aria-labelledby="data-heading">
      <h2 id="data-heading">Data</h2>
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
