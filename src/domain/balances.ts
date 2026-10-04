/**
 * Per-participant balance computation.
 */
import type { Balance, Ledger } from "./types";
import { splitEqualPaise } from "./split";

/**
 * Compute paid/share/net (in paise) for every participant in the ledger.
 *
 * - paid: sum of amounts of expenses the participant funded as payer.
 * - share: sum of the participant's assigned shares across all expenses.
 * - net: paid − share.
 *
 * Because each expense credits its full amount to exactly one payer and its
 * per-member shares sum to the same amount, the sum of all nets is exactly 0.
 * Participants are keyed by their stable id. The returned map includes an entry
 * for every participant, even those with no activity (all zeros).
 */
export function computeBalances(ledger: Ledger): Map<string, Balance> {
  const balances = new Map<string, Balance>();
  for (const p of ledger.participants) {
    balances.set(p.id, { paid: 0, share: 0, net: 0 });
  }

  for (const expense of ledger.expenses) {
    const payer = balances.get(expense.payerId);
    if (payer) {
      payer.paid += expense.amountPaise;
    }

    const shares = splitEqualPaise(expense.amountPaise, expense.splitIds);
    for (const [memberId, sharePaise] of shares) {
      const member = balances.get(memberId);
      if (member) {
        member.share += sharePaise;
      }
    }
  }

  for (const bal of balances.values()) {
    bal.net = bal.paid - bal.share;
  }

  return balances;
}

/** Total amount spent across all expenses, in paise. */
export function totalSpentPaise(ledger: Ledger): number {
  let total = 0;
  for (const e of ledger.expenses) total += e.amountPaise;
  return total;
}
