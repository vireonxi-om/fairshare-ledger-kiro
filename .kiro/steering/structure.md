# Structure steering — FairShare Ledger

## Repository layout
```
.
├─ .kiro/
│  ├─ steering/        # product.md, tech.md, structure.md
│  └─ specs/
│     └─ fairshare-ledger/   # requirements.md, design.md, tasks.md
├─ docs/
│  └─ evidence/        # reviewed, publishable phase evidence
├─ src/
│  ├─ domain/          # pure money/splitting/balance/settlement logic + types
│  ├─ persistence/     # versioned localStorage, import/export, sample, reset
│  ├─ ui/              # React components
│  ├─ App.tsx          # top-level shell wiring state + persistence + domain
│  ├─ main.tsx         # React entry
│  └─ styles.css       # app styles
├─ index.html
├─ package.json
└─ README.md
```

## Conventions
- Domain modules are named by concern: `money.ts`, `split.ts`, `balances.ts`,
  `settlement.ts`, `ledger.ts` (types + ledger-level helpers).
- Types live close to the domain that owns them. Shared types in
  `src/domain/types.ts`.
- Example tests sit next to the module under test: `money.test.ts`, etc.
- UI components are one component per file in `src/ui/`, PascalCase filenames.
- `.execution/` is private and gitignored; only curated artifacts under
  `docs/evidence/` are publishable.

## Naming
- Participant and expense identifiers are opaque stable string IDs.
- Money variables that hold paise are suffixed or clearly named `...Paise`.
- Functions are verbs (`parseMoneyToPaise`, `computeBalances`,
  `planSettlement`); types are nouns (`Ledger`, `Expense`, `Participant`).
