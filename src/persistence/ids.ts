/**
 * Stable id generation for new participants and expenses.
 *
 * Kept out of the pure domain layer because it is non-deterministic. The domain
 * accepts ids as arguments so it stays testable and deterministic.
 */

let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${counter}_${rand}`;
}
