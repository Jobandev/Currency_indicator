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

### Preview scheduler one-shot verification

- Verified the new deployment-scoped Shareable Link from the local Cloudflare Worker runtime against the exact Vercel Preview origin. The wrong bearer returned the RateWatch 401. The correct bearer reached the backend and initially returned 503, with no completed monitoring tick. The link was handled via Windows DPAPI and Wrangler stdin.
- Rechecked that the Ready deployment uses the reviewed `6ac2e1e` code and branch-exclusive `ratewatch-preview` Firebase configuration. The effective variable inventory had no live email or push credentials. Firestore initially had no active alerts, deliverable jobs, or registered push devices.
- Updated only the existing `ratewatch-scheduler-preview` Worker with the reviewed scheduler code and bindings for the exact Preview monitoring URL. Cloudflare reported version `acfbbb89-9589-4028-9b6e-f3105dc79cdb` and zero Cron triggers before and after the test.
- Seeded one synthetic FX alert in Preview with a reserved `example.invalid` recipient. The reviewed scheduled handler ran once in local Cloudflare Workerd and made one live POST to Vercel Preview. It returned HTTP 200 with outcome `completed` in 3.1 seconds. There was no POST retry or hosted Cron invocation.
- Firestore recorded exactly one pending notification job, zero delivery attempts, a processing alert, a released monitor lease, and zero push devices. An authenticated monitor GET returned HTTP 200 with a completion timestamp of `2026-11-19T08:17:23.301Z`, matching Firestore. The synthetic fixture remains in Preview for inspection.
- Regression checks passed again. Vitest reported 78 passing tests, the Firebase emulator integration test passed separately, and TypeScript, ESLint, and the production build passed.
- Milestone C Preview verification is complete. Hosted scheduling and real Brevo and FCM delivery require separate authorization. Production, billing, and project-wide Automation Bypass were untouched.

## Milestone D final verification

### Verified

- Reviewed local baseline `339daf6`. GitHub `preview` remained at `8d1cbc5` and `main` at `7f612da`.
- Recorded the synthetic run's one queued job and zero attempts, then atomically deleted its fingerprinted user, alert, and outbox documents from `ratewatch-preview`. Verified all three were absent afterward. Preserved the monitor timestamp and avoided real user records.
- Cloudflare Preview Worker version `acfbbb89-9589-4028-9b6e-f3105dc79cdb` still had zero remote Cron triggers. Vercel web and backend project IDs matched `ratewatch-preview` in Preview and `indicator-6bf61` in Production. Production?s project environment did not list `CRON_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `VITE_FIREBASE_VAPID_KEY`, or the optional `EXCHANGERATE_DEV_API_KEY`.
- 78 automated tests passed, with one Firebase Auth and Firestore emulator integration test passing separately. TypeScript, ESLint, production build, and Git whitespace checks passed. The production dependency audit reported zero advisories. Mocked tests covered alert deduplication, leases, retry and provider idempotency, signed unsubscribe, push opt-out, and expired-token cleanup.
- Chrome at 390 px passed converter calculation and swapping, charts and observation-table navigation, Firebase emulator signup and verification, sign-in, alert creation and pause/resume, and saved-plan linking and persistence. The tested routes had no document-level horizontal overflow.
- Chrome reported no installability errors in a fresh regular test profile. Service worker control, offline fallback, the keyboard skip link, prerendered headings, canonical markup, structured data, sitemap, private-route noindex, and API security headers passed. Physical-device install and background delivery remain live checks. The converter and chart disclose the dated reference source, and the disclaimer describes delayed observations, indicative rates, fees, and spreads.
- The WCAG 2.x axe scan reported serious text contrast failures on the homepage, charts, alert editor, dashboard, and planner. Examples include conversion detail text, chart source text, alert direction help, and the alert status badge. Treat these as accessibility blockers before public release.

### Current limits

- Cloudflare Workers Free allows 5 Cron triggers per account, 100,000 requests/day, 50 subrequests per invocation, and 10 ms of Cron CPU. One five-minute schedule is 288 ticks/day and the Preview path uses two outbound requests per tick. The one-shot wall time does not establish hosted CPU usage. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Vercel Hobby is restricted to personal, non-commercial use. Hobby Node functions with Fluid compute support a 300-second maximum. [Vercel Hobby](https://vercel.com/docs/plans/hobby) [Function limits](https://vercel.com/docs/functions/limitations)
- Brevo Free includes 300 sends/day. FCM's default downstream quota is 600,000 messages/minute per project. Firestore's free limits include 50,000 reads and 20,000 writes/day. At 288 ticks/day, each continually active alert adds roughly 288 scan reads/day before other application activity. [Brevo Free limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) [FCM quotas](https://firebase.google.com/docs/cloud-messaging/throttling-and-quotas) [Firestore quotas](https://firebase.google.com/docs/firestore/quotas)
- exchangerate.dev Free permits 5,000 calls/month and 10/minute with observations delayed by 15 minutes. One scheduler doing a shared poll every 30 minutes uses up to 1,488 calls in a 31-day month. Frankfurter publishes no daily or monthly quota and applies abuse rate limiting. Review source terms for the intended public use. [exchangerate.dev API](https://exchangerate.dev/docs/api-reference) [Frankfurter](https://frankfurter.dev/) [Frankfurter data terms](https://frankfurter.dev/license/)

### Final launch checklist

- [x] Correct the verified mobile text contrast issues and rerun the accessibility checks.
- [ ] Replace draft privacy and terms copy with approved operator details, retention and rights disclosures, and jurisdiction information. Confirm the intended launch qualifies for Vercel Hobby.
- [ ] Obtain separate send approval. Verify one Brevo alert in an approved inbox, including provider acceptance, sender identity, link navigation, and duplicate suppression. Verify one FCM alert on each approved test platform with a real install, app closed, and no delivery after device opt-out. Include Android Chrome and an installed iOS Safari PWA.
- [ ] Obtain approval for the Production scheduler credential and Brevo and FCM settings. The intraday provider key is needed only if intraday observations are offered at launch.
- [ ] Review and approve the Production release. Confirm public SEO, authentication, and security headers against the approved deployment before opening access.
- [ ] Keep Cron paused until an activation decision is approved. The Preview one-shot passed, but hosted Cron cadence and Free CPU usage still require observation during an approved activation. Production Cron requires the approved endpoint and its own bearer credential.

### Local contrast fixes and legal drafts

- Reproduced 30 failing text instances across the five mobile screens. The affected styles were conversion details, homepage step and feature copy, rate-source links and chart text, dark-section labels, alert editor navigation and help text, dashboard status badges and supporting copy, and planner instructions and saved-plan details. Desktop checks also caught shared header links, dashboard chips, and legal text.
- Darkened the existing muted foregrounds and status labels, used the existing mint color for text on the dark call to action, and set an explicit placeholder foreground. Kept the existing surfaces and hierarchy. Chart disclosure controls and provider links now meet the minimum 24 CSS pixel target size flagged by axe.
- WCAG-tagged axe checks reported zero violations across 13 tested mobile and desktop views and states. Browser-computed samples reached at least 5.09:1 for normal text and 5.23:1 for large text, against required minima of 4.5:1 and 3:1. Representative pairs include the standard alert status at 6.04:1, the queued status at 6.47:1, and the conversion total at 12.69:1. [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- The local regression suite passed 78 tests, plus one separate Firebase emulator integration test. TypeScript, ESLint, the production build, and Git whitespace checks passed.
- Expanded the privacy draft with saved-plan and device data, provider roles, notification controls, and the account deletion flow. Clarified the terms for observed rates, delivery limitations, provider quotes, and account closure. Operator identity and contacts, effective dates, actual retention and backup practices, applicable privacy rights, processing locations, eligibility, governing law, dispute procedures, and consumer terms still require confirmation.
- The contrast and legal copy changes are local. No deployment, Cron change, live delivery, billing change, or Production operation was made.

### Public policies and future advertising

- The Privacy Policy and Terms of Service use canonical paths `/privacy` and `/terms`. The earlier policy URLs redirect, and the disclaimer retains its existing path. Both policies are linked from the footer and account registration.
- The policy pages use the existing drafts and the operator details supplied in the conversation. No policy effective date, retention period, backup procedure, governing law clause, or legal guarantee has been inferred.
- Local production-build checks passed for policy metadata, canonical URLs, sitemap entries, legacy redirects, registration and footer navigation, and both policy pages at 320 CSS pixels with zero axe violations. The browser recorded no ad or analytics requests during the policy flow. The 78 automated tests, separate Firebase emulator integration test, TypeScript, ESLint, and production build passed.
- The source review found Firebase Authentication and optional Google sign-in, Firestore, FCM, configured email adapters, Frankfurter, exchangerate.dev, and direct transfer-provider links. Browser storage in the application supports sign-in, favourites, the first-alert guide, device preferences, and the offline fallback. The checked-in application contains no analytics tags, AdSense loader, advertising cookies, or affiliate parameters on the transfer-provider links. Hosting-level telemetry, provider storage and log retention, the active Production email provider, and deployment settings require independent confirmation.
- Keep the advertising integration absent by default. A future integration should centralize AdSense initialization on explicitly selected public routes, behind both a release decision and a consent result. The loader must avoid ad network requests and optional advertising storage until the required choices have been collected. Keep account, authentication, and other private routes outside that integration. Test declined consent, withdrawal, and fresh profiles before enabling ads. Confirm the applicable Google consent platform requirements, update the published disclosures against actual behavior, and review hosting eligibility before monetizing. [Google publisher consent requirements](https://support.google.com/adsense/answer/13554116) [Vercel Hobby](https://vercel.com/docs/plans/hobby)

## Milestone E production notification preparation

### Read-only findings

- Brevo is unconfigured for Production. The inventory does not include `BREVO_API_KEY` or `BREVO_SENDER_EMAIL`. `EMAIL_PROVIDER` exists, but its selected value could not be verified through the read-only effective environment. Legacy Gmail and Resend entries exist. No authorized Brevo credential was available for the sender and domain status checks. Confirm the intended provider and verify both sender and domain before testing. [Brevo sender and domain checks](https://developers.brevo.com/docs/getting-started-with-senders-and-domains)
- Production Firebase has a web app and reports Firebase Cloud Messaging, FCM Registration, and Firebase Installations enabled. The web project and backend project IDs align. The Production build configuration is missing `VITE_FIREBASE_MESSAGING_SENDER_ID` and `VITE_FIREBASE_VAPID_KEY`. The corresponding Web Push key pair and the deployed runtime identity's send permission remain unverified. Verify physical devices with Android Chrome and an iOS 16.4 or later Safari Home Screen installation. [FCM Web setup](https://firebase.google.com/docs/cloud-messaging/web/get-started) [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- Production is missing `CRON_SECRET`. The Production Worker name returned 404 in the inspected account. The existing Preview Worker `acfbbb89-9589-4028-9b6e-f3105dc79cdb` still has zero schedules. `DIGEST_SECRET` is also absent and is needed only for optional scheduled summaries.
- Production Firestore metadata reports Melbourne (`australia-southeast2`), zero configured TTL fields, zero managed backup schedules, zero listed managed backups, and point-in-time recovery disabled. Its one-hour version history setting is database metadata. It does not establish an application retention policy. Manual exports, provider copies, and external backups remain unverified. Deployed Vercel Function metadata and the project default both report Washington, D.C. (`iad1`). [Firestore locations](https://firebase.google.com/docs/firestore/locations) [Vercel Function regions](https://vercel.com/docs/functions/configuring-functions/region)
- Google documents U.S. processing for Firebase Authentication and globally distributed Firebase Cloud Messaging. The Production Firebase project is linked to Google Analytics. Application source contains no Firebase Analytics initialization. That association alone cannot establish what is collected. Cloudflare confirmed observability and logs enabled for the Preview Worker, with Logpush off. Vercel project telemetry objects did not expose enablement timestamps. Confirm provider logging periods, external exports, full processing geography, and dashboard telemetry separately. [Firebase privacy and processing locations](https://firebase.google.com/support/privacy/) [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)

### Notification behaviour and release approvals

- The permission prompt follows the enable action. A mocked denial made no registration request. The service worker accepted a mocked FCM data payload with a valid alert tag and destination, ignored malformed or off-origin payloads, and opened the dashboard alert link on click. These checks did not contact a notification provider.
- The 66 focused notification, scheduler, and Preview isolation tests passed. TypeScript, ESLint, and the production build passed. A read-only GET of the public Production homepage exposed no ad or analytics tags in the served HTML.
- A mocked refresh reproduced a late device registration after opt-out. The local fix invalidates pending refreshes and waits for any registration write already sent before removing the device. Mocked checks covered both orderings. The policy now describes verified provider locations and explains that clearing dashboard notifications hides them while delivery records remain available for deduplication and investigation.
- Email approval must name the authorized test environment, verified Brevo sender and domain, and one recipient inbox the operator controls. Authorize one synthetic transactional email, including use of the required credentials in that test environment. Verify one arrival and link navigation. If the outcome is ambiguous, inspect provider logs before any resend.
- Push approval must name the authorized HTTPS test origin and Firebase project, verified test account, and exact opted-in Android and iOS installations. Authorize one synthetic FCM multicast to those registrations. Confirm permission, app-closed receipt, notification tap, and that device opt-out removes the targeted registration. A further live send to prove non-delivery requires separate authorization. Keep the scheduler paused and keep the existing protected Preview delivery guard in place.
- Separate approval is needed for any Production configuration or deployment. Live inbox receipt, physical-device background delivery, operator-approved retention and backup practices, and applicable legal details remain open.

## Milestone F notification configuration

### Ready locally

- Confirmed that the Vercel Production frontend and backend select Firebase project `indicator-6bf61`. The configured Vercel Web App ID matches the Firebase Web app inspected. Its public `VITE_FIREBASE_MESSAGING_SENDER_ID` is `1077378996870`. Preview continues to use `ratewatch-preview`. No reviewed notification or Firebase environment variable was shared across the Production and Preview scopes.
- Added `scheduler/wrangler.production-paused.toml` for `ratewatch-monitor`. It matches the existing scheduler configuration with an empty Cron trigger list. The intended Worker destination is `https://currencyindicators.vercel.app/api/jobs/monitor`. Stage the Worker's matching bearer as `CRON_SECRET`. Keep Preview sharing credentials and protection bypass out of the Production Worker.
- Staged a dedicated 256-bit Production bearer locally in the Git-ignored, Windows DPAPI-protected `.tools/ratewatch-production-cron.dpapi` under the original Windows checkout. It differs from the Preview bearer. Neither provider received it. The existing Preview Worker still reports zero schedules, and the Production Worker was absent in the inspected Cloudflare account.
- `DIGEST_SECRET` is absent and remains outside this configuration. It is needed only if scheduled summaries are separately enabled.

### Awaiting operator action or approval

- `EMAIL_PROVIDER` exists as an unreadable Vercel Secret. Confirm its prior value from the operator's configuration record, or approve setting it to the known non-secret value `brevo` as a Production Config entry. Brevo's Production credentials are absent.
- In Brevo, open Settings > SMTP & API > API keys & MCP. Locate an existing key in the approved secret store or generate a dedicated RateWatch key there and save it when shown. In Senders, Domains & Dedicated IPs, check that the exact sender address is verified and its domain authenticated. If verification is still needed, use Brevo's sender and DNS steps with the owner of that sending domain. The public RateWatch support address does not establish the sender. Supply the API key only through a secure entry prompt or the Vercel Secret field after approval. `BREVO_SENDER_EMAIL` can be entered as Production Config. [Brevo API keys](https://developers.brevo.com/docs/quickstart) [Sender and domain verification](https://developers.brevo.com/docs/getting-started-with-senders-and-domains)
- In Firebase project `indicator-6bf61`, open Project settings > Cloud Messaging > Web configuration > Web Push certificates. Locate the existing public key for `VITE_FIREBASE_VAPID_KEY`. If no key pair exists, generating it requires approval for that Firebase Production change. Do not export the private key. Approve setting the verified sender ID and the public key as Production-only Vercel Config values. [Firebase Web Push configuration](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- The exact Firebase Admin runtime principal could not be verified from the unreadable Production `FIREBASE_SERVICE_ACCOUNT_JSON`. Identify its service-account email from the operator's secure credential record. Check `cloudmessaging.messages.create` for that principal on `indicator-6bf61` using IAM Policy Troubleshooter, without sending to FCM. A role change would require separate Production approval. Enabled FCM APIs do not prove the principal's permission. [Google Cloud FCM permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging)
- Approve Production variable writes separately when the input values are available. Reuse the dedicated encrypted bearer for the Vercel Production Secret and the intended Worker secret. Any future Worker deployment, Vercel deployment, hosted Cron activation, or live notification test requires separate authorization.

No cloud configuration, deployment, schedule, billing, notification, or Production data was changed.
