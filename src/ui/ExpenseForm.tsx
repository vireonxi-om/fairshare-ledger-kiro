import { useEffect, useId, useState } from "react";
import type { Ledger } from "../domain/types";
import { MIN_PARTICIPANTS } from "../domain/types";
import { addExpense } from "../domain/ledger";
import { newId } from "../persistence/ids";

interface Props {
  ledger: Ledger;
  onChange: (next: Ledger) => void;
}

/**
 * Today's date as "YYYY-MM-DD" using the browser's *local* calendar
 * components. Using `new Date().toISOString()` would format in UTC, which puts
 * the default on the wrong calendar day for users east of UTC before their
 * local offset elapses (e.g. before 05:30 IST in India). getFullYear/getMonth/
 * getDate read the local date, so the default always matches the user's day.
 */
function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ExpenseForm({ ledger, onChange }: Props) {
  const titleId = useId();
  const payerId = useId();
  const amountId = useId();
  const dateId = useId();

  const [title, setTitle] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [splitIds, setSplitIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ready = ledger.participants.length >= MIN_PARTICIPANTS;

  // When the ledger is replaced (import / sample / reset) or a participant is
  // deleted, drop any selected payer or split members that no longer exist.
  // Otherwise the form could submit a stale payer/split id that addExpense
  // would reject, or silently reference a participant from the old ledger.
  useEffect(() => {
    const existing = new Set(ledger.participants.map((p) => p.id));
    if (payer && !existing.has(payer)) {
      setPayer("");
    }
    setSplitIds((prev) => {
      const pruned = prev.filter((id) => existing.has(id));
      return pruned.length === prev.length ? prev : pruned;
    });
  }, [ledger.participants, payer]);

  function toggleSplit(id: string) {
    setSplitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = addExpense(ledger, newId("e"), {
      title,
      payerId: payer,
      amountText: amount,
      dateISO: date,
      splitIds,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setTitle("");
    setAmount("");
    setSplitIds([]);
    onChange(result.value);
  }

  if (!ready) {
    return (
      <section className="card" aria-labelledby="expense-heading">
        <h2 id="expense-heading">Add expense</h2>
        <p className="empty">
          Add at least {MIN_PARTICIPANTS} participants to start recording expenses.
        </p>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="expense-heading">
      <h2 id="expense-heading">Add expense</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor={titleId}>Title</label>
          <input
            id={titleId}
            type="text"
            value={title}
            maxLength={60}
            placeholder="e.g. Groceries"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={payerId}>Paid by</label>
            <select
              id={payerId}
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
            >
              <option value="">Select payer…</option>
              {ledger.participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={amountId}>Amount (₹)</label>
            <input
              id={amountId}
              type="text"
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor={dateId}>Date</label>
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: "0.85rem", color: "var(--muted)", padding: 0 }}>
            Split between
          </legend>
          <div className="split-list">
            {ledger.participants.map((p) => {
              const cbId = `split-${p.id}`;
              return (
                <div className="checkbox-row" key={p.id}>
                  <input
                    type="checkbox"
                    id={cbId}
                    checked={splitIds.includes(p.id)}
                    onChange={() => toggleSplit(p.id)}
                  />
                  <label htmlFor={cbId}>{p.name}</label>
                </div>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary">
          Add expense
        </button>
      </form>
    </section>
  );
}
