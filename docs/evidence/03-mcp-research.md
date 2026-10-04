# 03 — MCP Research: Property Tests & Exact Money Power

This document records technical findings gathered via MCP-backed documentation
fetching for two FairShare Ledger concerns:

1. **Property tests** — fast-check arbitraries (phase-later property testing).
2. **Exact Money power** — Kiro "Create powers" documentation.

## Method / provenance

- **MCP tool used:** `official-docs-fetch` MCP server — the `fetch` tool
  (fetches a URL and extracts contents as markdown; `raw` option returns
  unsimplified HTML).
- **Not used:** no `curl`, no `wget`, no shell HTTP. Retrieval was performed
  exclusively through the `fetch` MCP tool.
- **Date of retrieval:** 2026-10-04.

### Source URLs

| # | URL | Result |
|---|-----|--------|
| 1 | https://fast-check.dev/docs/core-blocks/arbitraries/ | Success — full technical content extracted |
| 2 | https://kiro.dev/docs/powers/create/ | Partial — body not retrievable (see limitation) |

---

## 1. fast-check arbitraries (source: https://fast-check.dev/docs/core-blocks/arbitraries/)

Retrieved via `official-docs-fetch` `fetch` tool. Verbatim technical findings:

- An arbitrary in fast-check is **not just a random value generator**. It is a
  **generator paired with a shrinker**. When a test fails, the shrinker walks
  the failing input back toward a simpler, easier-to-read counterexample. Every
  composed arbitrary inherits both halves of that contract (e.g. a counterexample
  on a deeply nested object can collapse to `[{ id: 0 }]` instead of random JSON).

- fast-check groups built-in arbitraries into **four families**:
  - **Primitives** — strings, numbers, booleans, dates, bigints. The only
    arbitraries with no upstream dependency; they anchor the shrink targets that
    every other family converges toward.
  - **Composites** — arrays, objects, iterables, functions, typed arrays.
    Arbitraries built out of other arbitraries to describe structured values.
  - **Combiners** — `oneof`, `option`, `letrec`, `.filter`, `.map`, `.chain`
    and friends. Functional glue: they take arbitraries as input and return new
    ones without generating anything themselves.
  - **Fake data** — UUIDs, emails, URLs, filenames and other realistic-shape
    values for code that branches on format.

- **Decision guide (verbatim intent):** start from a **primitive** if the value
  is atomic; a **composite** if it has a shape you can describe; a **combiner**
  when you already have an arbitrary and need to refine it; **fake data** only
  when your code cares about the *format* of a value rather than its raw
  contents. Anything that does not fit these four buckets lives on the "Others"
  page.

### Relevance to FairShare Ledger property tests

- Money is **integer paise**. The natural generator is a **primitive**
  integer arbitrary (non-negative). Shrinking toward smaller/simpler integers
  helps surface minimal failing paise amounts.
- Ledgers (participants + expenses) are **composites**: arrays of objects built
  from primitive ID/amount arbitraries.
- **Combiners** (`.filter`, `.map`, `.chain`) are the tool for enforcing domain
  invariants on generated data — e.g. mapping raw ints to valid paise, or
  filtering to non-negative amounts with ≤2 fractional digits semantics.
- Determinism concern: generated participant ID collections should be mapped to
  **sorted stable IDs** before feeding domain functions, matching the project's
  determinism rule. Combiners are the place to apply that normalization.
- Per tech steering, property tests (`fast-check`) are a **later phase** — this
  is research captured now, not an instruction to add them in phase 1.

---

## 2. Kiro "Create powers" (source: https://kiro.dev/docs/powers/create/)

Retrieved via `official-docs-fetch` `fetch` tool (both default markdown mode and
`raw` HTML mode attempted).

### Limitation — body content not retrievable (reported honestly)

- The default `fetch` (markdown) returned **only the page footer** (legal /
  navigation links); no documentation body.
- A follow-up `fetch` with `raw: true` returned the raw HTML and confirmed the
  cause: the page is a **Next.js client-side-rendered app**. The `<main>`
  element is empty except for streaming template placeholders
  (`<template id="B:1">`), and the actual docs content is injected by
  JavaScript that the fetch tool does not execute. Therefore the technical body
  (steps for building a power / the Agent Plugins specification) could not be
  extracted through the MCP fetch tool.

### What *was* reliably extracted from the fetched HTML metadata

These come directly from the retrieved document's `<head>` and structured data,
so they are genuine tool-derived findings (not assumed):

- **Page title:** "Create powers - Powers - Features - Docs - Kiro"
- **Meta description:** "How to build your own powers using the **Agent Plugins
  specification** and share them with the community."
- **Canonical URL:** https://kiro.dev/docs/powers/create/
- **Open Graph type:** article; OG image `https://kiro.dev/images/docs/powers/create.png`.

### Honest status for the Exact Money power

- The authoritative, step-by-step "Create powers" guidance could **not** be
  captured via the MCP fetch tool due to client-side rendering. The only
  tool-confirmed fact is that powers are built using the **Agent Plugins
  specification** (per the page's own meta description).
- No substitute HTTP method (curl/shell) was used to work around this, per the
  task constraints. If the full body is needed, options are: use a
  JS-rendering-capable retrieval method, or consult the Agent Plugins
  specification page directly.

---

## Summary

- **fast-check arbitraries:** fully retrieved via the `official-docs-fetch`
  `fetch` MCP tool; four-family model (primitives / composites / combiners /
  fake data) and the generator+shrinker contract are documented above and mapped
  to the ledger's paise/determinism rules.
- **Kiro create powers:** fetched via the same MCP tool, but the body is
  client-rendered and not extractable; only metadata (incl. the "Agent Plugins
  specification" reference) was captured. Reported as a partial result rather
  than claimed as a success.
