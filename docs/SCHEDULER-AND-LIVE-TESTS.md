# RateWatch Phase 3 scheduler and live test runbook

## Scheduler decision

Use Cloudflare Workers Free with one Cron Trigger at minutes 02, 07, 12 and so on in UTC. This is 288 invocations per day and 8,928 in a 31-day month. The account allowance is five triggers and 100,000 requests/day. A Free cron invocation has 10 ms CPU, 15 minutes wall time, and 50 subrequests. Waiting for one backend request does not consume CPU time. Schedule changes can take up to 15 minutes to propagate. Measure actual cadence and duration in preview. [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/) and [Cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

GitHub Actions is the fallback. Standard hosted runners in public repositories are free. GitHub Free private repositories have 2,000 included minutes per month. At five-minute cadence, even charging only one minute per run would exceed that private allowance. The schedule minimum is five minutes, runs use the default branch, busy periods can delay or drop jobs, and inactive public repositories have schedules disabled after 60 days. Do not make a private repository public for scheduling. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

The Worker has no public route. It POSTs to one exact HTTPS endpoint with bearer authentication, refuses redirects, and allows up to 310 seconds for the backend's configured 300-second function. The next tick handles recovery after a failed request. Firestore continues to own overlap prevention and notification idempotency. Only one scheduler should be enabled for each backend. A busy response means another invocation holds the lease. A successful response is not proof of notification delivery.

For Deployment-Protected Preview, the Worker must receive `VERCEL_AUTOMATION_BYPASS_SECRET` and send it as `x-vercel-protection-bypass`. The request uses manual redirect handling so an SSO or other 3xx response is recorded as `http_error` with its status instead of being mislabeled `network_error`. The bypass secret is not included in the URL or log payload.

## Deployment Protection decision

Do not enable project-wide Protection Bypass for Automation on the existing project: the project also hosts Production and a project-scoped secret would remain available to every deployment in that project. The existing deployment-specific Shareable Link and its cookie exchange may support manual browser/read-only checks, but they are not an adequate machine-to-machine contract for a scheduled POST unless Vercel has explicitly established that the cookie and redirect path remains valid for that exact deployment.

The smallest isolated configuration is:

1. Keep the existing Preview deployment protected and paused.
2. Create a separate Vercel Preview project only after separate approval.
3. Connect the same repository/branch to the dedicated Preview project, configure `ratewatch-preview` Firebase variables and a Preview-only `CRON_SECRET`, and preserve project Production Protection.
4. Generate that project's Protection Bypass secret and store it only as `VERCEL_AUTOMATION_BYPASS_SECRET` on the Worker.
5. Use wrong-secret GET and read-only authenticated GET checks before any POST.
6. Enable the Worker Cron trigger only after one isolated POST returns a valid success or documented busy response.

No project, deployment, bypass secret, environment variable, Cloudflare resource, or Cron trigger was changed during this investigation.

Cloudflare does not change the Vercel hosting terms. Vercel Hobby is for personal, non-commercial use. Confirm eligible hosting before a commercial launch or introducing referral commissions. Watch Vercel function time, Firestore free quotas and Brevo sending volume. [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)

## Wrangler preview preparation

The local preview uses scheduler/wrangler.preview.toml. The companion scheduler/wrangler.preview-paused.toml has the same Worker name, ratewatch-scheduler-preview, and an explicitly empty Cron Trigger list. Both omit public HTTP routes and reject the known production URL. A preview URL or hostname alone cannot establish Firebase or recipient isolation.

Before remote changes, verify the intended Cloudflare account and Workers Free subscription. Verify the exact Vercel Preview deployment and its environment assignments. It must use a separate Firebase project and Admin identity with no production permissions, an empty notification queue, no production users/device tokens, and no live notification credentials or enrolled recipients for the first scheduler-only validation. Generate a preview-only CRON_SECRET of at least 32 characters and set it only for that backend deployment; use the same value in the Worker. Confirm a read-only authenticated GET /api/jobs/monitor rejects the wrong secret and accepts the right one (503 is expected before the first healthy tick; 401 means authentication failed). Do not POST to production.

From the project root, validate locally:

~~~powershell
npx wrangler@4.165.0 whoami
npx wrangler@4.165.0 deploy --dry-run --config scheduler/wrangler.preview.toml
npx wrangler@4.165.0 deploy --dry-run --config scheduler/wrangler.preview-paused.toml
~~~

After explicit approval to create the preview Worker and provision secrets, deploy it paused and enter values at the Wrangler prompts:

~~~powershell
npx wrangler@4.165.0 deploy --config scheduler/wrangler.preview-paused.toml
npx wrangler@4.165.0 secret put MONITOR_URL --config scheduler/wrangler.preview-paused.toml
npx wrangler@4.165.0 secret put CRON_SECRET --config scheduler/wrangler.preview-paused.toml
npx wrangler@4.165.0 secret list --config scheduler/wrangler.preview-paused.toml
~~~

After isolation verification and activation approval, deploy the active config and inspect at least three completed scheduled invocations after propagation:

~~~powershell
npx wrangler@4.165.0 deploy --config scheduler/wrangler.preview.toml
npx wrangler@4.165.0 tail --config scheduler/wrangler.preview.toml
~~~

To pause or roll back, remove the trigger first. Code rollback is optional and requires an existing known-good version ID. It does not replace trigger management. On a first deployment, leave the Worker paused if there is no earlier good version.

~~~powershell
npx wrangler@4.165.0 deploy --config scheduler/wrangler.preview-paused.toml
npx wrangler@4.165.0 versions list --config scheduler/wrangler.preview-paused.toml
npx wrangler@4.165.0 rollback <KNOWN_GOOD_VERSION_ID> --config scheduler/wrangler.preview-paused.toml
~~~

Allow up to 15 minutes for trigger changes to propagate. Investigate repeated busy, configuration_error, timeout, invalid_response, or HTTP errors. Inspect the backend health endpoint and queue state independently. [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) and [Wrangler secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## Provider configuration

- The backend uses GET https://api.exchangerate.dev/v1/latest/USD with a symbols list and Authorization: Bearer EXCHANGERATE_DEV_API_KEY. No key is stored in the Worker. RATE_MONITOR_INTERVAL_MINUTES defaults to 30 and is clamped to at least 30. With the Firestore transaction gate, a five-minute Worker cadence still yields at most 1,488 polls in a 31-day month, below the documented free quota of 5,000/month and 10/minute. Deduct any other callers from that same allowance. Delayed observations are labelled and daily legs are excluded. Frankfurter v2 remains the daily reference and historical provider. [Exchangerate.dev API](https://exchangerate.dev/docs/api-reference), [pricing and attribution](https://exchangerate.dev/pricing), [Frankfurter](https://frankfurter.dev/)
- Preview backend and Firebase variables are listed in [Phase 2 verification](PRODUCTION-VERIFICATION.md). For email use EMAIL_PROVIDER=brevo, BREVO_API_KEY and BREVO_SENDER_EMAIL. For push use VITE_FIREBASE_MESSAGING_SENDER_ID and VITE_FIREBASE_VAPID_KEY alongside the public Firebase app variables. For summaries use DIGEST_SECRET and the preview APP_URL.

## Email test after explicit recipient and send approval

Build locally with npm run build. Privately set EMAIL_PROVIDER=brevo, BREVO_API_KEY, BREVO_SENDER_EMAIL and BREVO_SMOKE_RECIPIENT for the current shell. Use the authorised sender and one approved address you control. Verify transactional activation, the sender and the domain (Brevo verification, DKIM and DMARC as instructed by Brevo). Set APP_URL to the preview origin if checking links. The local CLI uses the existing HTTPS adapter, sends sample copy only, and does not touch Firestore. It requires both the recipient environment variable and an explicit send flag.

~~~powershell
npm run test:email:live -- --send-one preview-001
~~~

Expect one acceptance and one inbox email. If the outcome is ambiguous, check Brevo transactional logs first. The same run ID and recipient produce the same key within Brevo's 30-minute batch idempotency window. Never automatically repeat outside that window. Separately validate the scheduler and queue with an approved test alert in preview. The free allowance is 300 sends per day. [Brevo send API](https://developers.brevo.com/reference/send-transac-email), [idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails), [sender and domain setup](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)

## Push test after explicit send approval

Enable Firebase Cloud Messaging and configure the public Web Push VAPID key for the same Firebase web app. Use HTTPS and a verified preview test account. On Android Chrome, use Install or Add to Home Screen. On iOS 16.4 or later, use Safari Share, Add to Home Screen, then open the installed icon. On each device verify no prompt appears on page load. Open Settings, tap Enable, and test permission grant and denial. Save a push alert for the test account, close both apps, and wait for the approved scheduled run. Confirm one generic preview per enabled device, correct alert navigation, and delivery only to the still-enabled device after disabling the other. Check sign-in after relaunch and revoked-token cleanup. [Firebase Messaging](https://firebase.google.com/docs/cloud-messaging/web/get-started) and [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

## Phase 3 files

- Scheduler and credential hygiene — scheduler/wrangler.toml, scheduler/worker.js, scheduler/.gitignore.
- Health and test tooling — server/app.ts, server/brevo-smoke.ts, package.json, eslint.config.js, tests/platform.test.ts, tests/scheduler.test.js.
- Currency pages and discovery — shared/public-pages.ts, public-html.ts, vercel.json, src/CurrencyPair.tsx, src/Converter.tsx, src/Charts.tsx, src/App.tsx, src/ui.tsx. The build now generates sitemap.xml and replaces the static copy.
- Disclosures and accessibility — src/Account.tsx, src/Planner.tsx, src/styles.css.

## Release gates

Approve the isolated preview and scheduler activation separately from production deployment. Approve the exact email recipient and the push test account and devices before delivery. Approve sender or DNS changes, production Firebase and Vercel settings, and any plan purchase or billing change separately. Final legal review still needs the operator's identity, contact, jurisdiction, retention and applicable rights. Wise and Remitly links are direct and carry no affiliate identifiers. Any future referral arrangement needs approval and a reviewed, prominent disclosure. Verify deployed canonical URLs and sitemap, keyboard and screen-reader usability, mobile field metrics, and live scheduler/email/push before launch.
