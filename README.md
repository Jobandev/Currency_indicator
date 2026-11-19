# Ratewatch

A currency target-alert application built with React, Vite, TypeScript, Tailwind CSS, React Router, Lucide, Recharts, Express, Firebase Authentication, Firestore, and Firebase Cloud Messaging.

## Start locally

Use Node.js 24 LTS (recommended; this machine has Node 26). Dependencies are installed and package-lock.json is committed-ready.

1. Copy .env.example to .env.
2. Configure Firebase and your optional email provider using [Setup](docs/SETUP.md). Never paste private keys into VITE_ variables.
3. Run npm install (or npm ci on a clean checkout).
4. Run npm run dev.
5. Open http://localhost:5173. The API runs on port 3001.

Without configuration, the landing and account pages render but sign-in is explicitly disabled and rates are fetched from Frankfurter without requiring Firebase. There are no fabricated fallback prices or fake successful sends.

## Commands

| Command               | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| npm run dev           | Frontend and API in development                                |
| npm run typecheck     | Frontend and backend TypeScript                                |
| npm run lint          | ESLint                                                         |
| npm test              | Mocked service, REST, retry, concurrency, validation tests     |
| npm run test:emulator | Full Firebase Auth + Firestore integration (Java 21+ required) |
| npm run build         | Production frontend and backend                                |
| npm start             | Serve production frontend and API on PORT                      |
| npm run monitor       | One standalone monitoring run, suitable for a hosted cron job  |

## Included

- Responsive landing page, crawlable currency pages, protected dashboard, daily and delayed reference history, converter, notifications, profile, planner, and clearly marked legal drafts.
- Email/password registration and login, Google popup sign-in, verification, persistent sessions, password reset, logout, account deletion.
- Eight initial pairs, above/below inclusive targets, edit/delete/reactivate, explicit immediate-trigger consent, three active-or-processing alerts per account.
- Server-side monitoring endpoint, standalone worker, and Cloudflare Worker Cron trigger. Cloudflare only schedules the Vercel API; it does not host the application.
- Atomic Firestore transitions, per-user transaction serialization, generation-specific durable outbox, leases, retries, stable email payloads and idempotency keys.
- Authenticated API, verified email requirement, ownership checks, strict validation, CORS, Helmet, request limits, structured logs, Firestore rules and indexes.
- Unit/API tests with mocked exchange and email services; a Firebase emulator integration test and CI workflow.

## Rate accuracy

[Frankfurter v2](https://frankfurter.dev/) supplies daily reference and historical rates. Where configured, exchangerate.dev supplies delayed intraday observations; daily-only legs are never used for intraday alerts. Provider dates and retrieval timestamps remain distinct.

## Email semantics

A completed alert means the selected email or push provider accepted the message, not proof of inbox delivery. The dashboard says accepted. Delivery and bounce diagnostics remain with the provider; automatic delivery webhooks are not implemented. Immutable payloads and idempotency keys are retried within a bounded window, with ambiguous jobs held for review. See [operations](docs/OPERATIONS.md).

## Architecture

Browser → Vercel-hosted Express API → Firebase Admin / Firestore. Firebase client Auth obtains an ID token; the backend verifies it with revocation checks and derives the user ID itself. All mutations go through the backend; Firestore rules deny client writes. Cloudflare Worker Cron calls only the secret-protected Vercel monitor endpoint. Rates are grouped by base currency and shared across users. Matching alerts atomically become processing alongside one notificationLogs outbox record. Delivery obtains a two-minute lease, sends through the selected email provider or FCM, and transactionally marks accepted and completed.

See [setup](docs/SETUP.md), [deployment and costs](docs/DEPLOYMENT.md), and [operations/troubleshooting](docs/OPERATIONS.md).

## Limits before launch

Supply real credentials, deploy rules/indexes, review legal drafts, configure the scheduler, and perform an intentional real email smoke test to your own verified account. Mocked tests do not establish a working external integration. Free hosting has cold starts and quota limits. Thousands of users require capacity planning, shared API rate limiting, sharded workers, lifecycle/retention policy, and monitoring; this MVP is not an unlimited free service. Payment, Stripe, WhatsApp, admin screens, and mobile apps are deliberately absent. The server-owned free plan, provider interface, channel field, and generation keys provide extension points.
