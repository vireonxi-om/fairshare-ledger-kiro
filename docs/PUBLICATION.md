# Publishing FairShare Ledger to GitHub Pages

This document describes how the FairShare Ledger static site is published to
GitHub Pages. It covers the workflow, the expected public URL, how publishing
is triggered, what data the app stores, and the current deployment status.

## Status

**Not yet deployed.** The workflow and this document have been *prepared* but no
deployment has run. Pages has not been enabled on the repository, and no live
build or URL has been verified. Enabling Pages and verifying the first live
build is an explicit operator step (see "Enabling Pages" below). Nothing in this
change commits, pushes, or alters repository/account settings on its own.

## Expected public URL

Once deployed, the site is expected to be served at:

    https://vireonxi-om.github.io/fairshare-ledger-kiro/

This is a GitHub **project** Pages URL, so the site lives under the
`/fairshare-ledger-kiro/` sub-path rather than at a domain root. The build is
produced with `vite build -- --base=/fairshare-ledger-kiro/` so that all
JavaScript, CSS, and other asset references resolve correctly under that
sub-path. Local development (`npm run dev`) is unaffected and continues to serve
from `/`, because the base path is passed only in the Pages build and is not
hardcoded in `vite.config.ts`.

## How publishing works

Publishing is driven by a GitHub Actions workflow at
`.github/workflows/pages.yml`. It has two jobs:

1. **build** — checks out the repository, sets up Node 24, installs with
   `npm ci`, runs `npm run test` and `npm run typecheck`, builds the production
   bundle with the project base path, optionally includes a demo video if one
   exists, and uploads only the built `dist/` directory as the Pages artifact.
2. **deploy** — takes the artifact from the build job and deploys it to the
   `github-pages` environment via `actions/deploy-pages`.

Only the `dist/` output is published. Private working directories (for example
`.execution/`) are never uploaded.

### Triggers: manual and automatic

The workflow runs in exactly two situations:

- **Automatic:** on every push to the `main` branch.
- **Manual:** via **Actions → Deploy to GitHub Pages → Run workflow**
  (`workflow_dispatch`).

There is **no scheduled trigger**. The workflow never runs on a timer and never
creates scheduled or unattended commits.

### Permissions

The workflow defaults to least privilege (`contents: read`). The elevated
permissions required by Pages — `pages: write` and `id-token: write` — are
granted **only to the deploy job**, not globally. Deployment targets the
standard `github-pages` environment, which can enforce branch/deployment
protection rules.

### Action versions

The workflow pins the current major tags of the latest official GitHub Actions
releases, verified from each action's Releases page:

| Action | Pinned tag | Latest release verified |
| --- | --- | --- |
| `actions/checkout` | `v7` | v7.0.1 |
| `actions/setup-node` | `v7` | v7.0.0 |
| `actions/configure-pages` | `v5` | v5 (Node 24) |
| `actions/upload-pages-artifact` | `v5` | v5.0.0 |
| `actions/deploy-pages` | `v5` | v5.0.1 |

GitHub's custom-workflow documentation example currently shows older majors
(`checkout@v6`, `upload-pages-artifact@v4`, `deploy-pages@v4`); the pins above
track the newer verified releases while following the same workflow shape
described in that documentation.

## Demo video

If `docs/demo/fairshare-demo.mp4` exists at build time, the workflow copies it
into `dist/demo/fairshare-demo.mp4` so it is published alongside the app. The
demo video does **not** exist yet, so this step is currently a no-op and does
not fail the build.

## Data, privacy, and storage

FairShare Ledger is local-first. Ledger data is stored in the browser's
`localStorage` using a versioned schema and is **isolated per origin** — data
saved under the GitHub Pages origin is separate from data saved under a local
development origin or any other site. The app makes no network calls for ledger
data and includes **no analytics or tracking**. Publishing to Pages serves only
static files; it does not introduce any backend, account system, or telemetry.

## Enabling Pages (operator step)

The first deployment requires enabling GitHub Pages with the "GitHub Actions"
build source for the repository. This is performed by the operator through the
authenticated GitHub API or repository settings, after which they verify the
live build and confirm the public URL resolves. These steps are intentionally
left to the operator and are not performed by this change.
