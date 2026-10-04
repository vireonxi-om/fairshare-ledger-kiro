# 10 — Storage / App integration repair

Follow-up to the App integration review (`.execution/prompts/10-storage-integration.md`).
Four concrete integration risks were reproduced, fixed, and covered with a real
regression. No property tests were added (that remains an IDE task); this is
example/integration testing only. Nothing was published or committed, and no
Kiro config/powers were changed.

## Baseline before changes
`npm run test` → **6 files, 55 tests passed** (domain + persistence only).

## Findings (reproduced first)

### 1. `formatPaise` lost a paisa near the aggregate limit
`formatPaise` formatted money as `Intl.NumberFormat(...).format(paise / 100)`.
Dividing the paise *Number* by 100 is a float operation; at the aggregate bound
it loses precision. Reproduced with a standalone script:

```
8999999999999999  OLD= ₹8,99,99,99,99,99,999.98   EXACT= ₹8,99,99,99,99,99,999.99   *** DIFF ***
9000000000000001  OLD= ₹9,00,00,00,00,00,000.02   EXACT= ₹9,00,00,00,00,00,000.01   *** DIFF ***
-8999999999999999 OLD= -₹8,99,99,99,99,99,999.98  EXACT= -₹8,99,99,99,99,99,999.99  *** DIFF ***
(9e15-1)/100 = 89999999999999.98   <- float drops the .99
```

`MAX_LEDGER_TOTAL_PAISE` is `9e15`, so an aggregate (total/paid/share/net) near
the bound is reachable and would display a wrong paisa.

**Fix** (`src/domain/money.ts`): derive rupees and the two-digit paisa with
integer `Math.trunc`/remainder (`rupees = Math.trunc(abs/100)`,
`paisa = abs - rupees*100`), format only the *integer* rupee count via
`Intl.NumberFormat("en-IN")`, and reassemble `₹<rupees>.<paisa>`. The paise
value itself is never divided as a float. Non-integer/non-finite input now
throws `RangeError` instead of being silently `Math.round`-ed, so an upstream
precision bug surfaces rather than being masked. Output for normal values is
unchanged (`₹1,234.05`, `-₹5.00`, `₹0.05`).

Verified exact against a BigInt remainder oracle for `0, 5, 99, 100, 123405,
-1, -99, -123405, 9e15-1, 9e15-50, 9e15, -(9e15-1)`.

### 2. StrictMode could overwrite the unreadable primary payload
`src/main.tsx` wraps `<App />` in `React.StrictMode`, which double-invokes mount
effects in development. The old shell used `useRef(loadLedgerResult())` (the
loader expression ran every render) and a one-shot `skipNextSave` ref. The guard
skipped only the *first* effect invocation, so StrictMode's second mount effect
ran `saveLedger(emptyLedger())` over the corrupt `STORAGE_KEY`, destroying the
data the loader had just promised to preserve.

**Fix** (`src/App.tsx`):
- Load once per mount with a lazy `useState(() => loadLedgerResult())` so the
  loader is not re-evaluated on every render.
- Replace the effect-count guard with an identity gate: a `persistedLedger` ref
  holds the baseline (the loaded/fallback ledger). The save effect returns early
  when `ledger === persistedLedger.current`. A StrictMode effect replay, or any
  `storageError` state change, can no longer trigger a write — only an actual
  ledger reference change (a real user edit, import, reset, or sample load)
  advances the baseline and persists.
- On a `recovered` load the baseline is the empty fallback, so the corrupt
  primary is never overwritten until the user makes a real change.

### 3. Save effect retried on `storageError` changes
The old effect depended on `[ledger, storageError]`, so clearing or setting the
error re-ran the save even when the ledger had not changed.

**Fix**: the effect depends only on `[ledger]` and reads `storageError` from the
closure to decide whether to clear it. On a failed save the baseline is **not**
advanced, so a later successful save still runs (durable error semantics
preserved); on success the error is cleared.

### 4. Export JSON could not recover corrupt data; import file-read was uncaught
`Export JSON` serialises the *current* (empty fallback) ledger, so after a
corrupt load it exported nothing useful. The loader already stashes the raw
bytes under `RECOVERY_KEY` and returns `corruptRaw`.

**Fix** (`src/App.tsx`, `src/ui/DataControls.tsx`):
- App passes `recoveryRaw={initial.corruptRaw ?? null}` to `DataControls`.
- `DataControls` renders a **Download recovery data** button only when a corrupt
  payload exists; it downloads the *exact original bytes* (no re-serialise, no
  validate). Export JSON stays a separate control for valid ledgers.
- `handleImportFile` now wraps `await file.text()` in try/catch and surfaces an
  accessible `role="alert"` error if the file cannot be read; the current ledger
  is left untouched (import remains atomic).

## Test / tooling changes
- Added dev deps (pinned exact): `jsdom@30.1.2`, `@testing-library/react@16.3.3`,
  `@testing-library/dom@10.4.2`.
- `vite.config.ts` now uses Vitest `projects`: a **domain** project
  (`environment: node`, `src/**/*.test.ts`) preserves the pure-domain boundary,
  and a **ui** project (`environment: jsdom`, `src/**/*.test.tsx`) runs the
  integration test. Node remains the default for domain suites.
- New `src/App.test.tsx` integration regression (jsdom + Testing Library) mounts
  the real `<App />` in `React.StrictMode` against a real `localStorage` and asserts:
  1. a corrupt primary payload is preserved under `STORAGE_KEY` after mount
     (not overwritten with the empty fallback), and copied to `RECOVERY_KEY`;
  2. an accessible `role="alert"` recovery error is shown and the
     **Download recovery data** control downloads the exact original bytes;
  3. a valid/empty load creates no recovery copy and shows no recovery control.
- New boundary examples in `src/domain/money.test.ts` for the aggregate-limit
  paisa, negatives, and BigInt agreement, plus a non-integer rejection test.

### Regression actually catches the bug
Temporarily reinstating the old one-shot `skipNextSave` + `[ledger, storageError]`
effect made `src/App.test.tsx` fail (2 of 3 tests, including the
corrupt-primary-preservation assertion). Restoring the fix made it pass. The
test is sensitive to the specific defect, not a tautology.

## Final verification (actual output)
- `npm run test` → **7 files, 63 tests passed** (domain project + ui project).
- `npm run typecheck` (`tsc --noEmit`) → clean, no errors.
- `npm run build` (`tsc --noEmit && vite build`) → built `dist/` successfully
  (28 modules; `index-*.js` 161.24 kB / gzip 52.13 kB).
- `npm audit` → **found 0 vulnerabilities**.

## Scope / constraints honoured
- Existing UI preserved; the only visible addition is a conditional
  "Download recovery data" button shown exclusively when a corrupt payload is
  detected.
- No property tests added. No commit, no publish. No changes to `.kiro/` config,
  hooks, agents, or `powers/`.
