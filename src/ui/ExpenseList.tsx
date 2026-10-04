import type { Ledger } from "../domain/types";
import { formatPaise } from "../domain/money";
import { deleteExpense } from "../domain/ledger";

interface Props {
  ledger: Ledger;
  onChange: (next: Ledger) => void;
}

export function ExpenseList({ ledger, onChange }: Props) {
  const nameById = new Map(ledger.participants.map((p) => [p.id, p.name]));

  function handleDelete(id: string) {
    const result = deleteExpense(ledger, id);
    if (result.ok) onChange(result.value);
  }

  return (
    <section className="card span-all" aria-labelledby="history-heading">
      <h2 id="history-heading">Expense history</h2>
      {ledger.expenses.length === 0 ? (
        <p className="empty">No expenses recorded yet.</p>
      ) : (
        <ul className="plain">
          {ledger.expenses.map((e) => {
            const payer = nameById.get(e.payerId) ?? "Unknown";
            const members = e.splitIds
              .map((id) => nameById.get(id) ?? "Unknown")
              .join(", ");
            return (
              <li key={e.id}>
                <span>
                  <strong>{e.title}</strong>{" "}
                  <span className="muted">
                    · {formatPaise(e.amountPaise)} · paid by {payer} · {e.dateISO}
                  </span>
                  <br />
                  <span className="muted">Split: {members}</span>
                </span>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDelete(e.id)}
                  aria-label={`Delete expense ${e.title}`}
                  style={{ flex: "0 0 auto" }}
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
