#!/usr/bin/env node
// check-after-turn.mjs — Agent Stop hook wrapper for FairShare Ledger.
//
// Purpose
//   Run `npm run typecheck` after the agent finishes a turn and record a
//   compact, privacy-safe run record under the gitignored
//   `.execution/hook-runs/` directory. On typecheck failure it surfaces a short
//   message to the agent (via STDOUT) so the next turn can see what broke.
//
// Design constraints (see .kiro/steering/*, task brief)
//   - CLI-compatible: invoked by a `.kiro/hooks/*.json` command action on the
//     Agent Stop trigger. Kiro passes the Stop event as JSON on STDIN.
//   - Consume ONLY the event fields we actually need (hook_event_name, cwd).
//     Never persist raw STDIN, session_id, prompts, tool inputs, or any other
//     potentially sensitive session data.
//   - Concurrency safety: if a guardian/other process is editing the project
//     (signalled by a fresh lock file), SKIP the typecheck entirely so we do
//     not race against in-flight edits or report spurious errors.
//   - No side effects beyond writing run records under .execution/hook-runs/.
//     The typecheck itself is `tsc --noEmit` (no build output).
//
// Exit codes
//   0  — typecheck passed, or the run was skipped (lock / disabled). A skip is
//        not a failure of the turn, so we exit 0 to avoid noise.
//   1  — typecheck ran and reported type errors.
//   2  — wrapper-level error (could not run the check at all).
//
// Usage (standalone, for verification):
//   node scripts/check-after-turn.mjs            # reads STDIN if piped
//   echo '{"hook_event_name":"agentStop"}' | node scripts/check-after-turn.mjs

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  statSync,
  readFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

// --- Locate the project root (this file lives in <root>/scripts/). ----------
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);

const COORD_DIR = join(projectRoot, ".execution", "coordination");
const RUNS_DIR = join(projectRoot, ".execution", "hook-runs");

// Guardian / concurrent-edit lock. If this file exists and is recent, another
// process is modifying the project and we must not run the typecheck.
const LOCK_FILE = join(COORD_DIR, "guardian.lock");
// A lock older than this is treated as stale (process likely died) and ignored.
const LOCK_STALE_MS = 15 * 60 * 1000; // 15 minutes

// How much typecheck output to retain in the run record (bounded, no secrets).
const MAX_OUTPUT_CHARS = 8000;

/**
 * Read and parse the Stop event JSON from STDIN, if any was piped.
 * Returns only the whitelisted, non-sensitive fields we use. We deliberately
 * drop everything else (session_id, prompts, tool_input, env, etc.).
 */
function readMinimalEventContext() {
  let raw = "";
  try {
    // fd 0 = STDIN. When not piped (TTY), reading throws EAGAIN/ENXIO; ignore.
    raw = readFileSync(0, "utf8");
  } catch {
    return { hookEventName: null, cwd: null };
  }
  if (!raw.trim()) return { hookEventName: null, cwd: null };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed/non-JSON STDIN: proceed without context rather than failing.
    return { hookEventName: null, cwd: null };
  }

  // Whitelist exactly two non-sensitive fields.
  const hookEventName =
    typeof parsed?.hook_event_name === "string" ? parsed.hook_event_name : null;
  const cwd = typeof parsed?.cwd === "string" ? parsed.cwd : null;
  return { hookEventName, cwd };
}

/** True if a fresh (non-stale) guardian lock is present. */
function guardianLockActive() {
  if (!existsSync(LOCK_FILE)) return false;
  try {
    const ageMs = Date.now() - statSync(LOCK_FILE).mtimeMs;
    return ageMs >= 0 && ageMs < LOCK_STALE_MS;
  } catch {
    // If we cannot stat it, err on the side of caution and treat as active.
    return true;
  }
}

/** Write a run record. `record` must contain no sensitive session data. */
function writeRunRecord(record) {
  mkdirSync(RUNS_DIR, { recursive: true });
  const stamp = record.timestamp.replace(/[:.]/g, "-");
  const file = join(RUNS_DIR, `typecheck-${stamp}.json`);
  writeFileSync(file, JSON.stringify(record, null, 2) + "\n", "utf8");
  return file;
}

function main() {
  const ctx = readMinimalEventContext();
  const timestamp = new Date().toISOString();

  // --- Skip when a guardian / concurrent edit is in progress. ---------------
  if (guardianLockActive()) {
    const record = {
      timestamp,
      trigger: ctx.hookEventName ?? "agentStop",
      action: "typecheck",
      status: "skipped",
      reason: "guardian-lock-active",
      lockFile: ".execution/coordination/guardian.lock",
    };
    const file = writeRunRecord(record);
    console.log(
      `check-after-turn: skipped typecheck — guardian lock active (recorded ${relativize(file)}).`,
    );
    process.exit(0);
  }

  // --- Run the typecheck. ---------------------------------------------------
  const started = Date.now();
  const result = spawnSync("npm", ["run", "typecheck"], {
    cwd: projectRoot,
    encoding: "utf8",
    // Keep env as-is; do not persist it. tsc needs no secrets.
  });
  const durationMs = Date.now() - started;

  if (result.error) {
    // Could not even launch npm/tsc.
    const record = {
      timestamp,
      trigger: ctx.hookEventName ?? "agentStop",
      action: "typecheck",
      status: "error",
      reason: result.error.code || result.error.message || "spawn-failed",
      durationMs,
    };
    const file = writeRunRecord(record);
    console.error(
      `check-after-turn: could not run typecheck (${record.reason}); recorded ${relativize(file)}.`,
    );
    process.exit(2);
  }

  const exitCode = typeof result.status === "number" ? result.status : 1;
  const combined =
    (result.stdout || "") + (result.stderr || "");
  // Bound the retained output; tsc output is diagnostics only (no secrets),
  // but we still cap size to keep records small and avoid accidental spillover.
  const output = combined.slice(0, MAX_OUTPUT_CHARS);
  const truncated = combined.length > MAX_OUTPUT_CHARS;

  const record = {
    timestamp,
    trigger: ctx.hookEventName ?? "agentStop",
    action: "typecheck",
    command: "npm run typecheck",
    status: exitCode === 0 ? "passed" : "failed",
    exitCode,
    durationMs,
    output,
    outputTruncated: truncated,
  };
  const file = writeRunRecord(record);

  if (exitCode === 0) {
    console.log(
      `check-after-turn: typecheck passed in ${durationMs}ms (recorded ${relativize(file)}).`,
    );
    process.exit(0);
  }

  // Surface a concise failure summary to the agent's next-turn context.
  console.error(
    `check-after-turn: typecheck FAILED (exit ${exitCode}). See ${relativize(file)}.\n` +
      firstLines(output, 20),
  );
  process.exit(1);
}

/** Make a path project-relative for friendlier log messages. */
function relativize(absPath) {
  return absPath.startsWith(projectRoot + "/")
    ? absPath.slice(projectRoot.length + 1)
    : absPath;
}

/** First N non-empty lines of text, for a compact failure echo. */
function firstLines(text, n) {
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .slice(0, n)
    .join("\n");
}

main();
