# Operations and troubleshooting

## Delivery lifecycle

active — processing + immutable notificationLogs record (one Firestore transaction) — leased sending — sent + completed (second transaction). The generation is incremented on edit/reactivation, making a new notification key. Processing alerts count toward the three-alert limit and cannot be edited/deleted. Disabling preferences prevents new triggers; already queued notifications can still be processed.

A worker lease expires after two minutes. Resend requests time out after 15 seconds. Failures retain payload/key and retry exponentially from one minute to one hour on a subsequent scheduled run. Successful API acceptance stores the message ID. A crash after acceptance but before persistence retries the same immutable payload/key within Resend's 24-hour idempotency window. Once 23 hours from first attempt has elapsed the record becomes review_required and is not automatically resent. Never replace its key blindly.

To reconcile review_required: inspect Resend logs by message/recipient/time and idempotency key. If accepted, use a narrowly privileged operator script to mark the receipt accepted and matching generation completed in one transaction. If provably not sent, an operator may cancel the old generation and let the user create a new alert. No public admin override exists. Uncertain delivery should remain held. If email/address verification changes, deliver() refuses the stored recipient and retries/holds; inspect before reactivation. Final status means API acceptance, not inbox delivery.

Account deletion requires authentication within five minutes. An active send lease blocks deletion briefly. Deletion marks the user deleting first, which prevents new alert writes and queue claims; then removes alerts, notification records, Firebase account, and profile. If a provider or database failure interrupts cleanup, sign in and retry deletion. A recently expired send request can already have been accepted; deletion cannot recall mail. Provider logs/backups have their own retention policies.

## Logs and health

GET /api/health checks the process and reports whether a project ID exists. It does not prove database, sender, scheduler, or rate-provider availability. Structured events: monitor_rates_error, email_retry, email_accepted, request_error. They omit email bodies, credentials, and tokens. The system/monitor document records token, lease expiry, and lastCompletedAt. Rate failures are logged even if the queue succeeds; the endpoint returns HTTP 503 and the standalone worker exits nonzero after processing the queue so scheduler failure notifications can detect rate outages. lastRatesOk records the rate-fetch result. Queue sends are paced 600ms apart to avoid bursts; immediate API sends can still receive provider 429s and are queued for retry.

Alert operationally when scheduled invocations fail, lastCompletedAt is more than 45 minutes old, jobs remain pending too long, review_required appears, email failures spike, or daily usage approaches a quota. Monitor provider timestamps separately from fetch timestamps. Configure notifications in the host and scheduler; no external monitoring account has been created by this project.

## Common issues

- Sign-in disabled: .env must contain public VITE_FIREBASE_ values; restart Vite after editing it. For deployment, rebuild the frontend. Backend credentials do not configure the frontend.
- permission-denied / invalid-credential in backend: check server project and Admin credentials, IAM, Firestore creation, and emulator settings. Never solve this with permissive Firestore rules.
- Dashboard says index required: deploy firestore.indexes.json to the correct project and wait for completion. Emulator indexes do not validate production index provisioning.
- Google popup fails: check authorized domains and provider enablement; permit the sign-in popup. Production CSP permits Firebase frames and Google APIs.
- Verify email still required: use the email link then click I’ve verified. This reloads the account and refreshes the ID token. The backend checks Firebase directly when writing alerts.
- Authenticated request is 401: sign in again, check revoked sessions and correct project. User IDs in bodies are never accepted.
- CORS / proxy / 429: set APP_URL exactly and TRUST_PROXY only for the host's trusted proxy arrangement. API limits are process-local in this MVP; add a shared store for horizontal deployments.
- Rates missing: inspect provider status/network/timeouts and Firestore credentials. No stale or invented prices are used for triggers. Older daily reference rates can legitimately persist across holidays.
- Email pending: check RESEND_API_KEY, verified EMAIL_FROM domain, sender restrictions, daily/monthly quota, queue attempts, nextAttemptAt and leaseUntil. Allow the scheduler to retry. Recreating a queue entry risks duplicates.
- Email marked accepted but absent: inspect Resend delivery/bounce logs and spam folder. The app has no delivery webhook.
- Job unauthorized: POST the exact Authorization: Bearer header and a configured secret of at least 32 characters. Do not expose it in client code.
- Free host cold start: external HTTP scheduling may time out. Use an approved separate hosted cron worker for reliable scheduled execution.
- Emulator cannot start: install Java 21+ and Node 24; check ports 8080/9099/4000. The ignored .tools directory may hold a portable local JRE used during development. No Java system installation is required if JAVA_HOME/PATH point to it.
- npm engine warning on this machine: Node 26 is installed; the optional Firebase hosting tooling expects LTS. Use Node 24 for CI/deployment.

## Validation boundary

Mocked tests exercise real app handlers and engine code against a serial transactional store double. They cannot establish Firestore distributed contention correctness. The separate Firebase Auth/Firestore emulator test exercises registration, verification, login, actual transaction concurrency, API isolation, and direct Firestore rules, with email sending mocked. Neither suite sends real mail. Production integration must be smoke-tested with your configured project and own recipient.

## Future changes

Keep limits server-owned. Add a server-side entitlement resolver for billing later; do not accept a plan from the client. notificationType and provider interfaces allow additional channels/providers without changing ownership semantics. Add Stripe/WhatsApp only with explicit future requirements and consent. Before scaling, introduce shared throttles, queue partitions, bounded job budgets, retention cleanup, verified delivery webhooks, and abuse controls appropriate to real traffic.
