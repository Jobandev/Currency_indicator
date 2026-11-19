# Validation record

Updated 19 November 2026 against local `preview` at `d64766c`.

## Local results

- `npm test`: PASS — 72 passed, 1 skipped (73 total).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- Firebase Auth/Firestore emulator integration: BLOCKED because Firebase CLI could not download the Firestore emulator (`403`, DNS monitoring proxy).

The recovered preview branch includes mocked coverage for Brevo, FCM device ownership, delayed intraday observations, digest deduplication/unsubscribe, scheduler safety, alert pause/resume, and Transfer Planner ownership/edit/delete/linking.

## Not verified locally

- Deployed `ratewatch-preview` Firebase configuration, IAM, indexes, or rules.
- Cloudflare account identity, deployed Worker, Cron propagation, or Vercel Preview monitor POST.
- Real Brevo inbox delivery, FCM delivery, mobile installation, or device-token rotation.
- Production deployment, Core Web Vitals, legal approval, or production credentials.

No production resource, Firebase project, Vercel deployment, Cloudflare resource, recipient, or device was modified by these checks.
