# RateWatch progress

Updated 19 November 2026.

## Milestone A and architecture

RateWatch uses React and Vite on Vercel, the Node/Express API on Vercel, Firebase Authentication and Firestore, and a standalone Cloudflare Worker that calls the authenticated monitoring endpoint on schedule. The Node API owns rate refresh, monitoring, leases, queue processing, and delivery.

Review the local `ratewatch-consolidation` branch based on the recorded `origin/preview` at `8d1cbc5`. The original Windows checkout is `preview` at `d64766c`, with 11 modified tracked files and an intact `.env.example`. Local `main` and its recorded remote ref resolve to `7f612da`. The baseline was recovered from local Git metadata. Current remote tips were outside this local milestone.

The access-restricted backup contains the full original checkout, including Git metadata, modified and ignored files, local credentials and configuration, and `video-output/`. A follow-up inventory comparison passed and the backup opened at `d64766c`. SHA-256 comparisons passed for the four local environment files, media, Worker prototype, and local Vercel configuration. The original Windows checkout remains available with its working changes.

## Reconciliation

- Retained the website, API, Firebase rules and indexes, safe environment template, scheduler, and baseline tests. The recovered baseline includes saved transfer plans and alert linking, rates and charts, alerts, digests, Brevo and push support, PWA assets, and public metadata and indexing rules.
- Recovered the newer scheduler diagnostics and tests, including manual redirect handling, HTTP redirect status reporting, and optional Automation Bypass header support for an approved dedicated Preview project. The Shareable Link cookie experiment and its test are preserved in the backup for reference. Live scheduled POST behavior remains unverified.
- Ported two safeguards from the Windows monitor changes. The initial Firestore query starts without a document-ID cursor. Completion and lease release are recorded together under the current lease token. Kept Node pagination, batching, and delivery behavior.
- Preserved the full-app Worker prototype, its runbook, three REST adapter test files, and its TypeScript config in the private backup. The active checkout has no prototype source, imports, scripts, or test references. The Windows copy retains both the experimental edits and their original file locations.

## Local verification

| Check | Result |
| --- | --- |
| npm ci | Passed. npm warned about the Node 26 engine range for superstatic, deprecated packages, and three dependency install scripts subject to npm approval. |
| TypeScript and ESLint | Passed. |
| Vitest | 75 passed. The emulator integration test was skipped in this run and executed separately. |
| Firebase Auth and Firestore emulators | 1 integration test passed against demo-ratewatch with mocked delivery. It covered enrollment, sign-in, ownership, real Firestore monitor scanning, and alert completion. |
| Production build | Passed. Rollup removed two misplaced annotations in Zod. |
| Git whitespace and prototype-reference checks | Passed. |

The unit tests, production build, and emulator suite passed on retry after the Windows sandbox blocked esbuild configuration resolution and Firebase CLI configuration access. The emulator run logged a metadata lookup warning and completed successfully.

## Milestone B

1. Review the consolidation diff and confirm the current remote Preview tip. Reconcile any later commits before publishing.
2. Inspect the protected Vercel Preview deployment, Firebase Preview isolation, scoped variable names, Worker version, and actual remote Cron state using authenticated read-only access. The paused source config specifies an empty trigger list. Remote trigger state remains unknown.
3. Investigate timeouts and protection responses while keeping Cron paused. If a dedicated Preview project is needed, obtain separate approval before creating it. Keep project-wide Automation Bypass off the project that hosts Production.
4. After isolation and approval, verify the protected GET, then perform one controlled synthetic Preview POST with live delivery disabled. Review the Worker and backend results before any Cron activation decision.
5. Validate saved plans, linked alerts, charts, mobile PWA, accessibility, SEO, and security in Preview. Obtain separate approval for synthetic Brevo and FCM delivery. Review hosting terms and legal requirements before commercial launch.

No deploy, push, Cron activation, production Firebase operation, billing change, or live notification send occurred in Milestone A.
