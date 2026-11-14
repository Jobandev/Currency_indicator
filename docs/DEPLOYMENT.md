# Deployment and costs — no resources created

Reviewed 9 November 2026. Provider plans can change. Recheck the linked official pricing and the provider checkout before approving deployment. This repository does not deploy automatically.

## Cost choices

| Component                        | Candidate               | Limits and billing considerations                                                                                                                                                                                                        |
| -------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth + database                  | Firebase Spark          | No-cost quota; Firestore includes 50,000 reads / 20,000 writes per day. Spark stops at applicable limits. Blaze requires a billing account and can charge beyond included usage; budget alerts are not hard caps.                        |
| Rates                            | Frankfurter public v2   | Free, no API key; daily indicative data, no timing SLA. Respect fair use.                                                                                                                                                                |
| Email                            | Resend Free             | Published free tier: 3,000/month, 100/day. Verify current plan. A verified sending domain is needed and a new domain has separate registration cost.                                                                                     |
| Web frontend + API               | Render Free web service | Supports this Express app, but sleeps after 15 idle minutes and takes roughly a minute to wake. 750 shared free instance hours/month and bandwidth/build limits. Free instances are explicitly not recommended by Render for production. |
| Free scheduler                   | cron-job.org            | Free custom HTTP method/headers and schedules. Request timeouts, cold starts, and quotas make this a best-effort pilot, not a guaranteed 15-minute service.                                                                              |
| More dependable scheduled worker | Render Cron Job         | Paid: current docs describe a US$1/month minimum per job plus usage. Requires billing/payment setup and explicit approval. It runs separately from the sleeping web service.                                                             |

Sources: [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Firestore pricing](https://cloud.google.com/firestore/pricing), [Render free limitations](https://render.com/docs/free), [Render cron jobs](https://render.com/docs/cronjobs), [Render pricing](https://render.com/pricing), [Resend pricing](https://resend.com/pricing), [Resend free tier](https://resend.com/blog/new-free-tier), [cron-job.org](https://cron-job.org/en/).

A zero-hosting-cost pilot is possible within quotas if you already own a sending domain, with reduced reliability. A public service promising reliable unattended checks should use an approved paid scheduled worker or another scheduler with adequate execution time. Neither option depends on your laptop. No service, card, domain, or subscription has been provisioned.

## Publish the web app when approved

1. Put this repository in your chosen Git host; do not upload .env, service-account files, .tools, or node_modules.
2. Create a Render Node web service using Node 24. Select Free for a pilot or explicitly approve a paid instance. Review payment/card requirements and spend settings at that time.
3. Build command: npm ci && npm run build && npm prune --omit=dev. Start command: npm start. Health path: /api/health. Root directory: repository root. The server binds 0.0.0.0 and uses Render's PORT.
4. In build environment set all four public VITE_FIREBASE_ values. In server environment set FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON (or configured application-default credentials), RESEND_API_KEY, EMAIL_FROM, APP_URL (exact public origin), CRON_SECRET (random 32+ characters), NODE_ENV=production, TRUST_PROXY=1 when the platform has exactly one trusted proxy. Do not set USE_EMULATORS=true. Same-origin serving needs no VITE_API_URL.
5. Rebuild after changing VITE_ values. Private runtime secrets must never have that prefix. Use the platform secret store. Firebase Admin service accounts bypass rules; restrict IAM and keep keys private.
6. Deploy Firestore rules/indexes and add the production hostname to Firebase Auth authorized domains. Test verification and Google popup flows on that hostname.
7. Review the legal drafts and add the operator's actual legal/support information before accepting public users.

A multi-stage Dockerfile is also supplied. It accepts only public Firebase values as build args; inject private secrets at runtime. No Docker build or container deployment is claimed as tested unless separately validated.

## Schedule every 15 minutes

Preferred approved minimal-cost option: create a Render Cron Job from the same repo, build npm ci && npm run build, command npm run monitor, cron expression */15 * * * * (UTC; a 15-minute interval is timezone-independent). Add the same private Firebase/Resend/APP_URL variables. It does not need CRON_SECRET because it calls the worker locally. Review the minimum charge and usage estimate before creation. This job continues when the web service sleeps or your computer is off.

Free pilot option: create a cron-job.org job with URL https://YOUR_HOST/api/jobs/monitor, method POST, header Authorization: Bearer YOUR_CRON_SECRET, JSON body {}, interval every 15 minutes. Never put the secret in the URL. Enable failure emails. Trigger one manual run and check JSON/structured logs. Sleeping servers can exceed the scheduler timeout; do not treat registration of the schedule as proof of successful monitoring. Check repeated real runs, including after an idle period. Do not rely on an in-process timer on a free sleeping host. No browser setInterval is used.

## Capacity and launch acceptance

At 96 checks/day, 500 active alerts already imply about 48,000 alert document reads/day before profiles, queue, transaction retries, rates, and web activity. Thousands of users will exceed free quotas. The worker pages active alerts in blocks of 200 and handles up to 100 due messages per invocation. Jobs must finish within the 10-minute lease; increase capacity or shard scheduled work before approaching it. A second run is safe but not free. Use shared rate limiting and explicit plan configuration before scaling horizontally.

Before launch verify: credentials work, indexes are ready, scheduled jobs run with the browser closed, a real own-account smoke email arrives, retries do not duplicate, deletion succeeds after recent sign-in, and provider dates match. Confirm budget/quota and scheduler failure notifications. Roll back app releases using your host; do not roll back outbox generations or manually delete delivery records to retry mail.
