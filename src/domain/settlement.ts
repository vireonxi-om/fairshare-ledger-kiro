/**
 * Deterministic, bounded settlement planning.
 */
import type { Balance, Transfer } from "./types";

/**
 * Produce a list of transfers that clears every net balance to zero.
 *
 * Algorithm: greedy two-pointer over debtors (net < 0) and creditors (net > 0),
 * both ordered by ascending stable id for determinism. At each step we move the
 * largest amount that both the current debtor can pay and the current creditor
 * can receive, then advance whichever side reached zero.
 *
 * Guarantees:
 *  - every emitted amount is a positive integer;
 *  - no transfer has from === to (debtors and creditors are disjoint);
 *  - at most n−1 transfers for n participants with non-zero balance;
 *  - applying the transfers zeroes all balances (total debt equals total
 *    credit, which holds whenever the input nets sum to zero).
 *
 * This is NOT guaranteed to be the globally minimal number of transfers.
 *
 * Input: a map of participantId → Balance. Only the `net` field is used.
 */
export function planSettlement(balances: Map<string, Balance>): Transfer[] {
  interface Node {
    id: string;
    amount: number; // remaining magnitude (positive)
  }

  const debtors: Node[] = [];
  const creditors: Node[] = [];

  const ids = [...balances.keys()].sort();
  for (const id of ids) {
    const net = balances.get(id)!.net;
    if (net < 0) debtors.push({ id, amount: -net });
    else if (net > 0) creditors.push({ id, amount: net });
  }

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      transfers.push({
        fromId: debtor.id,
        toId: creditor.id,
        amountPaise: amount,
      });
      debtor.amount -= amount;
      creditor.amount -= amount;
    }

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transfers;
}
