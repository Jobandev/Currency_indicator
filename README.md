# Ratewatch

A free currency target-alert MVP built with React, Vite, TypeScript, Tailwind CSS, React Router, Lucide, Recharts, Express, Firebase Authentication, Firestore, and Resend. Built in this workspace; nothing has been deployed or connected to a paid account.

## Start locally

Use Node.js 24 LTS (recommended; this machine has Node 26). Dependencies are installed and package-lock.json is committed-ready.

1. Copy .env.example to .env.
2. Configure Firebase and Resend using [Setup](docs/SETUP.md). Never paste private keys into VITE_ variables.
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

- Responsive landing page, protected dashboard, daily reference history, converter, notifications, profile, and clearly marked legal drafts.
- Email/password registration and login, Google popup sign-in, verification, persistent sessions, password reset, logout, account deletion.
- Eight initial pairs, above/below inclusive targets, edit/delete/reactivate, explicit immediate-trigger consent, three active-or-processing alerts per account.
- Server-side monitoring endpoint and standalone worker. Configure an external scheduler every 15 minutes; the browser never schedules checks.
- Atomic Firestore transitions, per-user transaction serialization, generation-specific durable outbox, leases, retries, stable email payloads and idempotency keys.
- Authenticated API, verified email requirement, ownership checks, strict validation, CORS, Helmet, request limits, structured logs, Firestore rules and indexes.
- Unit/API tests with mocked exchange and email services; a Firebase emulator integration test and CI workflow.

## Rate accuracy

[Frankfurter v2](https://frankfurter.dev/) is a free, keyless provider of daily reference rates. This product checks every 15 minutes but does not claim intraday prices. UI dates come from the provider; fetchedAt records retrieval separately. Source dates older than five days or cache retrieval older than 20 minutes cannot trigger alerts. Weekends may legitimately show the last business-day reference. For intraday alerts, replace RateProvider with a suitably licensed provider and revisit freshness rules.

## Email semantics

A completed alert means Resend accepted the API request, not proof of inbox delivery. The dashboard says accepted. Delivery/bounce diagnostics remain in the Resend dashboard; automatic delivery webhooks are not implemented. The immutable outbox payload and key are retried within a bounded window. Resend retains keys for [24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys); unresolved jobs are held for review after 23 hours instead of risking another send. This is an at-most-once preference at that boundary, not an impossible distributed exactly-once guarantee. See [operations](docs/OPERATIONS.md).

## Architecture

Browser → Express REST API → Firebase Admin / Firestore. Firebase client Auth obtains an ID token; the backend verifies it with revocation checks and derives the user ID itself. All mutations go through the backend; Firestore rules deny client writes. A hosted scheduler calls the secret-protected job endpoint or invokes the standalone worker. Rates are grouped by base currency and shared across users. Matching alerts atomically become processing alongside one notificationLogs outbox record. Delivery obtains a two-minute lease, calls Resend with the stored payload/key, and transactionally marks accepted and completed. Processing alerts count toward the free limit.

See [setup](docs/SETUP.md), [deployment and costs](docs/DEPLOYMENT.md), and [operations/troubleshooting](docs/OPERATIONS.md).

## Limits before launch

Supply real credentials, deploy rules/indexes, review legal drafts, configure the scheduler, and perform an intentional real email smoke test to your own verified account. Mocked tests do not establish a working external integration. Free hosting has cold starts and quota limits. Thousands of users require capacity planning, shared API rate limiting, sharded workers, lifecycle/retention policy, and monitoring; this MVP is not an unlimited free service. Payment, Stripe, WhatsApp, admin screens, and mobile apps are deliberately absent. The server-owned free plan, provider interface, channel field, and generation keys provide extension points.
