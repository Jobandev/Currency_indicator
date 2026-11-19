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

GitHub's Preview tip was verified read-only at `8d1cbc5`. The five Milestone A changes were reviewed and committed locally as `9614ad4` on `ratewatch-consolidation`.

The homepage now presents the converter alongside the primary heading, with dated rates immediately below. The converter makes the converted total, unit rate and source easier to distinguish. The dashboard places alerts before market tools and renders each alert as a readable card on narrow screens while keeping the table semantics and row actions. The alert editor emphasizes the current reference and condition selection. The charts page has responsive filters, compact statistics, and a visible series key alongside its observation tables. The original framework, API, Firebase integration, and scheduler remain in use.

Fixed early registration navigation while profile setup and verification were pending. Protected alert links now carry their destination through sign-in. Selecting a dashboard alert tab clears the direct alert fragment so it stops overriding the selected tab.

### Local verification

- Mobile Chrome at 390 px exercised converter calculations, swap and identical-currency validation, real Frankfurter history, a period change, and the observations table. The tested routes fit the viewport without document-level horizontal scrolling.
- Browser account creation, email verification, sign-in, rate alert creation, pause/resume, and a saved transfer plan with a linked alert used the local Firebase Auth and Firestore emulators. Reload confirmed the link had persisted. A signed-out visitor returned to the direct alert after sign-in and could switch tabs.
- Desktop Chrome against the built app verified that the service worker controls the page and returns the offline fallback. Checked the web manifest and icons, keyboard skip link, prerendered heading, canonical URL, structured data, sitemap, and private-route noindex.
- TypeScript, ESLint, the production build, and Git whitespace checks passed. Vitest reported 75 passed. The separate Firebase emulator integration test passed. Rollup reported two annotation warnings from Zod.

### Preview readiness

Local checks support an isolated Preview smoke test after configuration review. The deployed environment, Google sign-in, device-specific PWA installation, and live delivery remain unverified. Confirm the Vercel Preview Firebase project and protection settings, scoped configuration, the Worker version, and its actual remote trigger state. Keep Cron paused. Use a separately approved test for any synthetic monitor POST or live email or push check.

No push, deployment, project creation, hosting change, Cron activation, billing change, or real notification occurred.

## Milestone C

### Read-only remote checks

- GitHub `preview` still resolves to `8d1cbc5`. Milestone B remains in the local branch history at `3f74397`.
- Vercel confirmed the latest inspected deployment is Ready and targets Preview. The `preview` branch's frontend and backend Firebase project variables select `ratewatch-preview`. The scoped variable list contains the Preview scheduler and Firebase Admin credentials, with email, digest, push VAPID, and intraday provider credentials absent.
- A direct monitoring GET returned 302 to Vercel sign-in. The existing Shareable Link returned a same-origin 307 and set cookies. Using those cookies, a wrong bearer returned the RateWatch JSON 401, the correct bearer returned 503 with no completed tick, and health returned 200 with Admin configured.
- Firebase metadata confirmed the Preview web app and default Firestore database. The existing Preview service account could read that database. The monitor document was absent, and the read-only counts returned zero deliverable jobs and zero push registrations.
- Cloudflare reported Preview Worker version `0104fc90-2fcd-4f90-a907-76c5f81078c6` at 100% and zero remote Cron triggers. The Worker has the monitor URL, Preview bearer, and Shareable Link secret bindings. No Automation Bypass binding was listed.

### Local changes and verification

- Scoped the Worker share-cookie exchange to the configured Preview origin. The Worker refuses cross-origin credentials and redirects, makes one monitor POST, and distinguishes share exchange errors, HTTP failures, and network timeouts.
- Preview monitor ticks evaluate rates and create outbox entries with delivery disabled. The delivery guard covers email and FCM, including immediate-alert requests. The emulator test calls the authenticated POST twice against a synthetic target and confirms one pending job with zero delivery attempts. A separate mocked delivery check confirms one completion across concurrent attempts.
- Unit coverage verifies monitor lease ownership and overlap, pause/resume, alert-generation deduplication, the shared 30-minute intraday cap, Brevo HTTPS and idempotency, and mocked FCM success and expired-token cleanup.
- Final checks passed. Vitest reported 78 passing tests, and the Firebase Auth and Firestore emulator integration test passed separately. TypeScript, ESLint, the production build, and Git whitespace checks passed.
- The live POST and live email/push were deferred. The deployed backend has yet to receive the local delivery guard.

### Remaining launch gates

After deployment approval, update the existing Vercel Preview and existing paused Worker with this revision. Align the Worker target and Shareable Link to the exact confirmed Preview origin. Repeat read-only authentication checks, then perform one controlled synthetic Preview POST and verify one pending outbox job, zero delivery attempts, and updated monitor health. Keep the production-linked project's Automation Bypass disabled. If the Shareable Link fails for an actual Worker POST, keep Cron paused and resolve Preview-scoped machine authentication before activation. Live Brevo and FCM tests require separate approval.

No remote settings, deployments, Cron triggers, billing, production data, or notification delivery were changed.

### Preview deployment verification

- Vercel deployed reviewed commit `6ac2e1e` from a clean local staging copy on the `preview` branch. It reported Ready, environment Preview, and Vercel Authentication enabled. GitHub `preview` remained at `8d1cbc5` and `main` at `7f612da`.
- Preview URL is [currencyindicators-2w4khe5gk-j-5e92.vercel.app](https://currencyindicators-2w4khe5gk-j-5e92.vercel.app). [Vercel deployment details](https://vercel.com/j-5e92/currency_indicators/78EfcJk2DSTi12PrCFYvBGqC5bKn)
- The effective branch configuration points to `ratewatch-preview` and the allowlist contained no production credential, live email, or push configuration. Vercel's short-lived project identity reached the new deployment for read-only verification. A wrong monitor bearer returned an application 401. The correct bearer returned 503 with no completed tick. Health returned 200 with Firebase configured.
- The Preview runtime identity independently read `ratewatch-preview` Firestore. The monitor state was absent and the counts showed zero deliverable jobs and zero push registrations.
- The old deployment's Shareable Link redirected to Vercel sign-in when tested against the new hostname and issued no auth cookie. The Worker update and synthetic monitoring POST stopped at that gate. The deployed Worker remains at `0104fc90-2fcd-4f90-a907-76c5f81078c6`, with zero remote Cron triggers. No synthetic records were written and no notifications were sent.
- Regression checks passed on the deployed revision. Vitest reported 78 passing tests. The separate Firebase emulator integration test, TypeScript, ESLint, the production build, and Git whitespace checks passed.
- To finish, use a Shareable Link scoped to this exact Preview hostname and provision it privately. Verify the new link exchange before updating the Worker target and code with Cron paused. Then run the single approved synthetic POST and confirm one queued job, zero delivery attempts, and updated monitor health.
