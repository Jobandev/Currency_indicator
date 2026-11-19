# Deployment and costs — Vercel + Firebase + Cloudflare Scheduler

The active application is hosted on the existing Vercel project. Cloudflare is only an authenticated scheduled HTTPS caller and does not host the frontend or API.

## Components

| Component | Final choice | Status |
| --- | --- | --- |
| Web/API | Existing Vercel project | Configured by `vercel.json`; Production remains on `main`. |
| Auth/data | Firebase Authentication + Firestore | Rules, indexes, Admin ownership checks, and transactions are checked in. |
| Daily/history rates | Frankfurter v2 | Public daily reference and historical data. |
| Delayed intraday rates | exchangerate.dev | Optional server-only keyed provider. |
| Scheduler | Cloudflare Worker Cron | Preview config is paused by default; no production activation here. |
| Email | Brevo | HTTPS adapter and smoke-test tooling are included. |
| Push | Firebase Cloud Messaging | Device registration and push delivery code are included. |

No production credentials, Firebase projects, Vercel deployments, Cloudflare resources, billing, recipients, or devices are changed by local development.

## Vercel

Use the existing project with:

- Install: `npm ci`
- Build: `npm run test:runtime && npm run build`
- Health: `/api/health`

Preview must use the `ratewatch-preview` Firebase project and Preview-only Admin identity. Production must continue using `indicator-6bf61`. Set public `VITE_FIREBASE_` values at build time and private Firebase Admin, Brevo, `APP_URL`, `CRON_SECRET`, `NODE_ENV`, and proxy settings only in Vercel environment configuration. Never expose private credentials through `VITE_` variables.

## Cloudflare monitor trigger

The Worker sends:

```text
POST https://YOUR_VERCEL_HOST/api/jobs/monitor
Authorization: Bearer YOUR_CRON_SECRET
```

The checked-in preview scheduler rejects redirects, unsafe URLs, the known production hostname, invalid secrets, and malformed responses. Keep the Cron trigger paused while validating Preview DNS/TLS, redirects, timeout behavior, and monitor completion. Never put the secret in the URL or logs.

Use `docs/SCHEDULER-AND-LIVE-TESTS.md` for dry-run, paused deployment, activation, tailing, and rollback procedures. Only one scheduler should be active for a backend.

## Launch acceptance

Before enabling any schedule or sending notifications, verify Firebase Admin permissions, Firestore indexes/rules, alert ownership, queue leases, notification deduplication, one approved Brevo recipient, and one approved FCM test device in Preview. Complete the legal, accessibility, mobile PWA, and performance checks in `docs/PRODUCTION-VERIFICATION.md`.
