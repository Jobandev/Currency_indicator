# RateWatch progress

Updated 19 November 2026.

## Baseline

The complete development baseline is local `preview` at `d64766c`, matching `origin/preview`. It includes the earlier commits `b3bd7f1` and `50a93b5`. Local `main` remains at `7f612da` and was not changed.

The pre-recovery local changes were preserved in stash `pre-recovery local preview work` and a patch backup under the session state directory. They were not reapplied because the recovered branch already contains a more complete implementation of the same PWA/SEO surfaces.

## Preserved functionality

- Vercel React/Vite frontend and Express API.
- Firebase Authentication, Firestore rules, indexes, ownership checks, transactions, leases, and queue deduplication.
- Cloudflare Worker Cron scheduler only; no Cloudflare frontend/API host.
- Brevo email adapter and smoke-test tooling.
- Firebase Cloud Messaging device registration, opt-in, token cleanup, and push alerts.
- Frankfurter daily/history rates and delayed exchangerate.dev intraday observations.
- Weekly/monthly digests with signed unsubscribe links.
- Alert pause/resume, one-time completion, notification preferences, and status synchronization.
- Transfer Planner persistence, editing, deletion, user ownership, and alert linking.
- Crawlable public pages, PWA manifest/service worker/offline fallback, noindex private routes, sitemap, canonical metadata, and structured data.

## Verification

- Mocked suite: PASS — 74 passed, 1 skipped; 75 total.
- TypeScript: PASS.
- ESLint: PASS.
- Production build: PASS.
- Firebase emulator: BLOCKED by a 403 download failure through the environment DNS monitoring proxy.
- Deployed Preview, Cloudflare runtime, Brevo delivery, FCM delivery, and mobile/browser field metrics: NOT VERIFIED.

## Scheduler connectivity investigation

- Paused Cloudflare Worker Cron configuration: PASS — Wrangler dry-run succeeds and no Cron trigger is configured.
- Worker unit tests: PASS — 6 tests cover successful POST parsing, busy responses, unsafe destinations, HTTP failures, timeout classification, production-host rejection, the 302 distinction, and the Vercel Automation Bypass header.
- Confirmed mechanism: Vercel Deployment Protection returns SSO/302 responses. The Worker now uses manual redirect handling and can send `x-vercel-protection-bypass` from a protected secret.
- `network_error` from the earlier deployment remains ambiguous without Cloudflare response status/logs and the Vercel bypass result. The smallest fix is in place, but live verification is blocked until Cloudflare and Vercel credentials are available.

## Remote authentication status

- Vercel CLI: NOT AUTHENTICATED; no Vercel token or project variables are available in this session.
- Cloudflare CLI: NOT AUTHENTICATED; no Cloudflare API or account variables are available in this session.
- Remote Preview deployment, Automation Bypass settings, Worker secrets, Worker logs, and deployment-specific Shareable Link state are therefore NOT VERIFIED.
- Project-wide Automation Bypass is not an approved option because the existing project can host Production.
- The existing deployment-specific Shareable Link is suitable only for manually reviewed read-only/browser diagnostics unless a separately verified machine-safe bypass is available.

## Cleanup

No obsolete Cloudflare application frontend/backend files were found on the recovered branch. The retained `scheduler/` directory is the only Cloudflare implementation. No remote branches or production resources were deleted. No uncertain Docker or Firebase configuration was removed.

The temporary local backup branch remains until the consolidated commit is created; it can then be removed safely. The preservation stash remains because it contains the prior session's uncommitted user-visible changes.

## Remaining work

1. Run the emulator suite in an environment that can download or already has the Firebase emulator binaries.
2. Validate the isolated Vercel Preview/Firebase configuration and paused Cloudflare Worker using the documented runbooks.
3. Perform explicitly approved synthetic Brevo and FCM Preview tests.
4. Complete legal, accessibility, mobile PWA, and production performance review before deployment.
