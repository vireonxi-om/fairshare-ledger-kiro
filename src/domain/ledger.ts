/**
 * Pure ledger operations and validation.
 *
 * All mutating helpers return a new Ledger (immutable updates) wrapped in a
 * Result so the UI can surface accessible validation errors instead of throwing.
 * No side effects, no storage, no Date/random here — ids and dates are provided
 * by callers.
 */
import {
  type Expense,
  type Ledger,
  type Participant,
  type PersistedDoc,
  type Result,
  SCHEMA_VERSION,
  MAX_NAME_LEN,
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  MAX_TITLE_LEN,
  MAX_EXPENSE_PAISE,
  MAX_LEDGER_TOTAL_PAISE,
  err,
  ok,
} from "./types";
import { parseMoneyToPaise } from "./money";

export function emptyLedger(): Ledger {
  return { currency: "INR", participants: [], expenses: [] };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateISO(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  // Round-trip guard against e.g. 2024-02-31 being normalized.
  return d.toISOString().slice(0, 10) === s;
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export function addParticipant(
  ledger: Ledger,
  id: string,
  rawName: string,
): Result<Ledger> {
  // Identity validation: a stable, non-empty, unique id is required so this
  // helper can never emit a ledger that validateLedger would later reject.
  if (typeof id !== "string" || id.trim().length === 0) {
    return err("Participant id must be a non-empty stable identifier.");
  }
  if (ledger.participants.some((p) => p.id === id)) {
    return err("Participant id must be unique.");
  }
  const name = rawName.trim();
  if (name.length < 1) return err("Participant name cannot be empty.");
  if (name.length > MAX_NAME_LEN) {
    return err(`Participant name must be at most ${MAX_NAME_LEN} characters.`);
  }
  if (ledger.participants.length >= MAX_PARTICIPANTS) {
    return err(`A ledger can have at most ${MAX_PARTICIPANTS} participants.`);
  }
  const lower = name.toLowerCase();
  if (ledger.participants.some((p) => p.name.toLowerCase() === lower)) {
    return err(`A participant named "${name}" already exists.`);
  }
  const participant: Participant = { id, name };
  return ok({ ...ledger, participants: [...ledger.participants, participant] });
}

export function isParticipantReferenced(ledger: Ledger, id: string): boolean {
  return ledger.expenses.some(
    (e) => e.payerId === id || e.splitIds.includes(id),
  );
}

export function deleteParticipant(ledger: Ledger, id: string): Result<Ledger> {
  if (!ledger.participants.some((p) => p.id === id)) {
    return err("Participant not found.");
  }
  if (isParticipantReferenced(ledger, id)) {
    return err("Cannot delete a participant used by an expense. Delete those expenses first.");
  }
  return ok({
    ...ledger,
    participants: ledger.participants.filter((p) => p.id !== id),
  });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export interface ExpenseInput {
  title: string;
  payerId: string;
  amountText: string;
  dateISO: string;
  splitIds: string[];
}

export function addExpense(
  ledger: Ledger,
  id: string,
  input: ExpenseInput,
): Result<Ledger> {
  // Identity validation: a stable, non-empty, unique id is required so this
  // helper can never emit a ledger that validateLedger would later reject.
  if (typeof id !== "string" || id.trim().length === 0) {
    return err("Expense id must be a non-empty stable identifier.");
  }
  if (ledger.expenses.some((e) => e.id === id)) {
    return err("Expense id must be unique.");
  }

  // An expense requires at least MIN_PARTICIPANTS people in the ledger, matching
  // the product/spec requirement and the UI gate in ExpenseForm.
  if (ledger.participants.length < MIN_PARTICIPANTS) {
    return err(
      `Add at least ${MIN_PARTICIPANTS} participants before recording an expense.`,
    );
  }

  const title = input.title.trim();
  if (title.length < 1) return err("Expense title cannot be empty.");
  if (title.length > MAX_TITLE_LEN) {
    return err(`Expense title must be at most ${MAX_TITLE_LEN} characters.`);
  }

  if (!ledger.participants.some((p) => p.id === input.payerId)) {
    return err("Payer must be an existing participant.");
  }

  const amountPaise = parseMoneyToPaise(input.amountText);
  if (amountPaise === null) {
    return err("Amount must be a number with at most two decimal places.");
  }
  if (amountPaise <= 0) {
    return err("Amount must be greater than zero.");
  }
  if (amountPaise > MAX_EXPENSE_PAISE) {
    return err("Amount is too large.");
  }

  // Aggregate guard: keep the running ledger total (and therefore every derived
  // balance and transfer) within the exact-integer range.
  const currentTotal = ledger.expenses.reduce(
    (sum, e) => sum + e.amountPaise,
    0,
  );
  if (currentTotal + amountPaise > MAX_LEDGER_TOTAL_PAISE) {
    return err(
      "This expense would push the ledger total beyond the supported maximum.",
    );
  }

  if (!isValidDateISO(input.dateISO)) {
    return err("Date must be a valid calendar date (YYYY-MM-DD).");
  }

  const uniqueSplit = [...new Set(input.splitIds)];
  if (uniqueSplit.length < 1) {
    return err("Select at least one participant to share the expense.");
  }
  const participantIds = new Set(ledger.participants.map((p) => p.id));
  if (!uniqueSplit.every((sid) => participantIds.has(sid))) {
    return err("Split participants must all be existing participants.");
  }

  const expense: Expense = {
    id,
    title,
    payerId: input.payerId,
    amountPaise,
    dateISO: input.dateISO,
    splitIds: uniqueSplit,
  };
  return ok({ ...ledger, expenses: [...ledger.expenses, expense] });
}

export function deleteExpense(ledger: Ledger, id: string): Result<Ledger> {
  if (!ledger.expenses.some((e) => e.id === id)) {
    return err("Expense not found.");
  }
  return ok({ ...ledger, expenses: ledger.expenses.filter((e) => e.id !== id) });
}

// ---------------------------------------------------------------------------
// Validation (structural + referential)
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate an untrusted value as a Ledger. Returns a fully-typed Ledger on
 * success or null on any structural or referential problem. Never throws.
 */
export function validateLedger(value: unknown): Ledger | null {
  if (!isObject(value)) return null;
  if (value.currency !== "INR") return null;
  if (!Array.isArray(value.participants)) return null;
  if (!Array.isArray(value.expenses)) return null;

  const participants: Participant[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const p of value.participants) {
    if (!isObject(p)) return null;
    if (typeof p.id !== "string" || p.id.length === 0) return null;
    if (typeof p.name !== "string") return null;
    const name = p.name.trim();
    if (name.length < 1 || name.length > MAX_NAME_LEN) return null;
    if (seenIds.has(p.id)) return null;
    const lower = name.toLowerCase();
    if (seenNames.has(lower)) return null;
    seenIds.add(p.id);
    seenNames.add(lower);
    participants.push({ id: p.id, name });
  }
  if (participants.length > MAX_PARTICIPANTS) return null;

  const expenses: Expense[] = [];
  const seenExpenseIds = new Set<string>();
  let totalPaise = 0;
  for (const e of value.expenses) {
    if (!isObject(e)) return null;
    if (typeof e.id !== "string" || e.id.length === 0) return null;
    if (seenExpenseIds.has(e.id)) return null;
    if (typeof e.title !== "string") return null;
    const title = e.title.trim();
    if (title.length < 1 || title.length > MAX_TITLE_LEN) return null;
    if (typeof e.payerId !== "string" || !seenIds.has(e.payerId)) return null;
    if (
      typeof e.amountPaise !== "number" ||
      !Number.isSafeInteger(e.amountPaise) ||
      e.amountPaise <= 0 ||
      e.amountPaise > MAX_EXPENSE_PAISE
    ) {
      return null;
    }
    totalPaise += e.amountPaise;
    if (totalPaise > MAX_LEDGER_TOTAL_PAISE) return null;
    if (typeof e.dateISO !== "string" || !isValidDateISO(e.dateISO)) return null;
    if (!Array.isArray(e.splitIds) || e.splitIds.length < 1) return null;
    const splitIds: string[] = [];
    const seenSplit = new Set<string>();
    for (const sid of e.splitIds) {
      if (typeof sid !== "string" || !seenIds.has(sid)) return null;
      if (seenSplit.has(sid)) return null;
      seenSplit.add(sid);
      splitIds.push(sid);
    }
    seenExpenseIds.add(e.id);
    expenses.push({
      id: e.id,
      title,
      payerId: e.payerId,
      amountPaise: e.amountPaise,
      dateISO: e.dateISO,
      splitIds,
    });
  }

  return { currency: "INR", participants, expenses };
}

/**
 * Validate a persisted document (schema version + ledger). Returns the inner
 * ledger on success, null otherwise. Never throws.
 */
export function validatePersistedDoc(value: unknown): Ledger | null {
  if (!isObject(value)) return null;
  if (value.schemaVersion !== SCHEMA_VERSION) return null;
  return validateLedger(value.ledger);
}

export function toPersistedDoc(ledger: Ledger): PersistedDoc {
  return { schemaVersion: SCHEMA_VERSION, ledger };
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

/** A fixed, valid demo ledger with deterministic ids and dates. */
export function sampleLedger(): Ledger {
  const participants: Participant[] = [
    { id: "p_sample_1", name: "Aarav" },
    { id: "p_sample_2", name: "Diya" },
    { id: "p_sample_3", name: "Kabir" },
  ];
  const expenses: Expense[] = [
    {
      id: "e_sample_1",
      title: "Groceries",
      payerId: "p_sample_1",
      amountPaise: 123400, // ₹1,234.00
      dateISO: "2026-01-05",
      splitIds: ["p_sample_1", "p_sample_2", "p_sample_3"],
    },
    {
      id: "e_sample_2",
      title: "Taxi to station",
      payerId: "p_sample_2",
      amountPaise: 45050, // ₹450.50
      dateISO: "2026-01-06",
      splitIds: ["p_sample_1", "p_sample_2"],
    },
    {
      id: "e_sample_3",
      title: "Dinner",
      payerId: "p_sample_3",
      amountPaise: 90001, // ₹900.01 — exercises remainder distribution
      dateISO: "2026-01-07",
      splitIds: ["p_sample_1", "p_sample_2", "p_sample_3"],
    },
  ];
  return { currency: "INR", participants, expenses };
}
