import { useId, useState } from "react";
import type { Ledger } from "../domain/types";
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS } from "../domain/types";
import { addParticipant, deleteParticipant, isParticipantReferenced } from "../domain/ledger";
import { newId } from "../persistence/ids";

interface Props {
  ledger: Ledger;
  onChange: (next: Ledger) => void;
}

export function ParticipantsPanel({ ledger, onChange }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const result = addParticipant(ledger, newId("p"), name);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setName("");
    onChange(result.value);
  }

  function handleDelete(id: string) {
    const result = deleteParticipant(ledger, id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange(result.value);
  }

  const atMax = ledger.participants.length >= MAX_PARTICIPANTS;
  const belowMin = ledger.participants.length < MIN_PARTICIPANTS;

  return (
    <section className="card" aria-labelledby="participants-heading">
      <h2 id="participants-heading">Participants</h2>

      <form onSubmit={handleAdd}>
        <div className="field">
          <label htmlFor={inputId}>Add participant</label>
          <div className="row">
            <input
              id={inputId}
              type="text"
              value={name}
              maxLength={40}
              placeholder="Name"
              onChange={(e) => setName(e.target.value)}
              aria-describedby={error ? "participant-error" : undefined}
            />
            <button type="submit" className="primary" disabled={atMax} style={{ flex: "0 0 auto" }}>
              Add
            </button>
          </div>
        </div>
      </form>

      {atMax && (
        <p className="muted">Maximum of {MAX_PARTICIPANTS} participants reached.</p>
      )}
      {belowMin && (
        <p className="muted">
          Add at least {MIN_PARTICIPANTS} participants before recording expenses.
        </p>
      )}

      {error && (
        <p className="alert" role="alert" id="participant-error">
          {error}
        </p>
      )}

      {ledger.participants.length === 0 ? (
        <p className="empty">No participants yet.</p>
      ) : (
        <ul className="plain">
          {ledger.participants.map((p) => {
            const inUse = isParticipantReferenced(ledger, p.id);
            return (
              <li key={p.id}>
                <span>{p.name}</span>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDelete(p.id)}
                  disabled={inUse}
                  title={inUse ? "Used by an expense; delete those expenses first." : "Delete participant"}
                  aria-label={`Delete ${p.name}`}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
