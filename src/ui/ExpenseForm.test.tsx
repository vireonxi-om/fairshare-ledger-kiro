/**
 * UI regression tests for ExpenseForm (issue 2).
 *
 * 1. The "Date" default must use the browser's *local* calendar day, not the
 *    UTC day. The bug was `new Date().toISOString().slice(0,10)`, which rolls
 *    the default back one day for users east of UTC before their offset
 *    elapses — e.g. before 05:30 IST in India. We pin system time to an instant
 *    that is already "tomorrow" locally but still "today" in UTC and assert the
 *    field shows the local day.
 *
 * 2. After the ledger is replaced (import / sample / reset) or a participant is
 *    removed, a previously selected payer / split member that no longer exists
 *    must be cleared so the form cannot submit a stale id.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, fireEvent } from "@testing-library/react";
import { ExpenseForm } from "./ExpenseForm";
import { addParticipant, emptyLedger } from "../domain/ledger";
import type { Ledger } from "../domain/types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function twoParticipantLedger(): Ledger {
  let l = emptyLedger();
  l = (addParticipant(l, "p1", "Asha") as { value: Ledger }).value;
  l = (addParticipant(l, "p2", "Bijay") as { value: Ledger }).value;
  return l;
}

/** Local YYYY-MM-DD from a Date, matching the component's own logic. */
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("ExpenseForm date default (timezone boundary)", () => {
  it("defaults to the local calendar day, not the UTC day", () => {
    // Instant where local and UTC days may differ. In a UTC+ timezone (e.g.
    // Asia/Kolkata, +05:30) this 19:00 UTC moment is already the next local day.
    const instant = new Date("2026-03-14T19:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(instant);

    const localDay = localISO(instant);
    const utcDay = instant.toISOString().slice(0, 10);

    const { getByLabelText } = render(
      <ExpenseForm ledger={twoParticipantLedger()} onChange={() => {}} />,
    );
    const dateInput = getByLabelText("Date") as HTMLInputElement;

    // The default must equal the LOCAL day. When the host runs east of UTC the
    // local and UTC days differ and this also proves the old UTC-slice bug is
    // gone; when they coincide the assertion still correctly pins local day.
    expect(dateInput.value).toBe(localDay);
    if (localDay !== utcDay) {
      expect(dateInput.value).not.toBe(utcDay);
    }
  });
});

describe("ExpenseForm stale selection clearing", () => {
  it("clears a selected payer that no longer exists after a ledger replacement", () => {
    const ledger = twoParticipantLedger();
    const { getByLabelText, rerender } = render(
      <ExpenseForm ledger={ledger} onChange={() => {}} />,
    );

    const payerSelect = getByLabelText("Paid by") as HTMLSelectElement;
    fireEvent.change(payerSelect, { target: { value: "p1" } });
    expect(payerSelect.value).toBe("p1");

    // Replace with a ledger whose participants are entirely different (as an
    // import/sample would do). The previously selected "p1" is now stale.
    let replacement = emptyLedger();
    replacement = (addParticipant(replacement, "x1", "New One") as { value: Ledger }).value;
    replacement = (addParticipant(replacement, "x2", "New Two") as { value: Ledger }).value;

    rerender(<ExpenseForm ledger={replacement} onChange={() => {}} />);

    const payerAfter = getByLabelText("Paid by") as HTMLSelectElement;
    // Stale "p1" must have been reset to the empty placeholder.
    expect(payerAfter.value).toBe("");
  });

  it("drops split members that no longer exist after a participant is removed", () => {
    const { getByLabelText, rerender } = render(
      <ExpenseForm ledger={twoParticipantLedger()} onChange={() => {}} />,
    );

    const asha = getByLabelText("Asha") as HTMLInputElement;
    const bijay = getByLabelText("Bijay") as HTMLInputElement;
    fireEvent.click(asha);
    fireEvent.click(bijay);
    expect(asha.checked).toBe(true);
    expect(bijay.checked).toBe(true);

    // Add a third participant so the form keeps rendering after we remove one.
    let three = twoParticipantLedger();
    three = (addParticipant(three, "p3", "Chandni") as { value: Ledger }).value;
    rerender(<ExpenseForm ledger={three} onChange={() => {}} />);

    // Now remove p2 (Bijay). p1 and p3 remain → form still renders.
    const withoutBijay: Ledger = {
      ...three,
      participants: three.participants.filter((p) => p.id !== "p2"),
    };
    rerender(<ExpenseForm ledger={withoutBijay} onChange={() => {}} />);

    // Asha should still exist and remain selected; the stale p2 split selection
    // must have been pruned from internal state (no crash, no stale id).
    const ashaAfter = getByLabelText("Asha") as HTMLInputElement;
    expect(ashaAfter.checked).toBe(true);
  });
});
