import { useMemo } from "react";
import type { Ledger } from "../domain/types";
import { formatPaise } from "../domain/money";
import { computeBalances, totalSpentPaise } from "../domain/balances";
import { planSettlement } from "../domain/settlement";

interface Props {
  ledger: Ledger;
}

export function Dashboard({ ledger }: Props) {
  const { balances, total, transfers } = useMemo(() => {
    const balances = computeBalances(ledger);
    return {
      balances,
      total: totalSpentPaise(ledger),
      transfers: planSettlement(balances),
    };
  }, [ledger]);

  const nameById = new Map(ledger.participants.map((p) => [p.id, p.name]));
  const hasExpenses = ledger.expenses.length > 0;

  return (
    <section className="card span-2" aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading">Dashboard</h2>

      <p>
        <span className="muted">Total spent</span>
        <br />
        <span className="total-spent num">{formatPaise(total)}</span>
      </p>

      {ledger.participants.length === 0 ? (
        <p className="empty">Add participants to see balances.</p>
      ) : (
        <>
          <h3 style={{ fontSize: "1rem" }}>Balances</h3>
          <table>
            <caption className="visually-hidden">
              Per participant paid, share, and net balance
            </caption>
            <thead>
              <tr>
                <th scope="col">Participant</th>
                <th scope="col">Paid</th>
                <th scope="col">Share</th>
                <th scope="col">Net</th>
              </tr>
            </thead>
            <tbody>
              {ledger.participants.map((p) => {
                const b = balances.get(p.id)!;
                const netClass = b.net < 0 ? "net-neg" : "net-pos";
                const netLabel =
                  b.net < 0
                    ? `owes ${formatPaise(-b.net)}`
                    : b.net > 0
                      ? `is owed ${formatPaise(b.net)}`
                      : "settled";
                return (
                  <tr key={p.id}>
                    <th scope="row">{p.name}</th>
                    <td className="num">{formatPaise(b.paid)}</td>
                    <td className="num">{formatPaise(b.share)}</td>
                    <td className={`num ${netClass}`}>
                      {formatPaise(b.net)}
                      <span className="visually-hidden"> ({netLabel})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <h3 style={{ fontSize: "1rem" }}>Settlement plan</h3>
      {!hasExpenses ? (
        <p className="empty">No expenses yet, so there is nothing to settle.</p>
      ) : transfers.length === 0 ? (
        <p className="empty">Everyone is already settled.</p>
      ) : (
        <ul className="plain">
          {transfers.map((t, idx) => (
            <li key={idx}>
              <span>
                <strong>{nameById.get(t.fromId) ?? t.fromId}</strong> pays{" "}
                <strong>{nameById.get(t.toId) ?? t.toId}</strong>
              </span>
              <span className="num">{formatPaise(t.amountPaise)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Plan uses at most n−1 transfers and clears all balances. It is not
        guaranteed to be the globally minimal number of transfers.
      </p>
    </section>
  );
}
