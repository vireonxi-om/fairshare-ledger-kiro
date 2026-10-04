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
    <section className="card" aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading">Balances &amp; settlement</h2>

      <div className="stats">
        <div className="stat stat-primary">
          <span className="stat-label">Total spent</span>
          <span className="stat-value num">{formatPaise(total)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Expenses</span>
          <span className="stat-value num">{ledger.expenses.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Participants</span>
          <span className="stat-value num">{ledger.participants.length}</span>
        </div>
      </div>

      {ledger.participants.length === 0 ? (
        <p className="empty">Add participants to see balances.</p>
      ) : (
        <>
          <h3>Balances</h3>
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
          <p className="muted">
            Net shows who is owed (positive) or who owes (negative). All
            balances sum to zero.
          </p>
        </>
      )}

      <h3>Settlement plan</h3>
      {!hasExpenses ? (
        <p className="empty">No expenses yet, so there is nothing to settle.</p>
      ) : transfers.length === 0 ? (
        <p className="empty">Everyone is already settled — no transfers needed.</p>
      ) : (
        <>
          <p className="muted">A practical plan to settle the group.</p>
          <ul className="settlement-list">
            {transfers.map((t, idx) => (
              <li className="settlement-card" key={idx}>
                <span className="pay-flow">
                  <strong>{nameById.get(t.fromId) ?? t.fromId}</strong>
                  <span className="arrow" aria-hidden="true">
                    →
                  </span>
                  <strong>{nameById.get(t.toId) ?? t.toId}</strong>
                </span>
                <span className="amount num">{formatPaise(t.amountPaise)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="help">
        <summary>How this plan works</summary>
        <p>
          The plan clears every balance to zero using at most n−1 transfers for
          n people with non-zero balances. It is correct and bounded, but it is
          not guaranteed to be the globally minimal number of transfers.
        </p>
        <p>
          When an expense does not divide evenly, the leftover paise are handed
          out one at a time to participants in ascending order of their stable
          ID. This keeps every split exact and independent of the order people
          were added.
        </p>
      </details>
    </section>
  );
}
