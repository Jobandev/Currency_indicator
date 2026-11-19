# RateWatch Vercel Preview

The linked Vercel project is currency_indicators and its production branch is main. Scope all remote changes to Preview and the selected non-production branch. Keep Cloudflare paused.

## Configuration after separate approval

- The verified Firebase web config is staged in .env.ratewatch-preview.web. The 32-byte cron secret is in .env.ratewatch-preview.cron-secret. Git and Vercel CLI uploads ignore both files.
- Provision a dedicated runtime service account in ratewatch-preview. Scope it to preview Firestore document access and the Firebase Auth user lookup, update and delete permissions the application uses. Give it no production grants, broad Editor or Owner access, or FCM sending permissions. The current backend supports a preview certificate stored in the FIREBASE_SERVICE_ACCOUNT_JSON Vercel Secret. Vercel OIDC is an alternative requiring separate cloud configuration and application changes.
- Set FIREBASE_PROJECT_ID=ratewatch-preview, USE_EMULATORS=false and VITE_USE_EMULATORS=false, and populate the VITE_FIREBASE_* build values from the staged config. Set CRON_SECRET as a Preview Secret. Leave VITE_API_URL unset. Use the verified preview origin for APP_URL when known. The build and runtime guards use VERCEL_ENV=preview, so verify Vercel exposes system environment variables.
- Audit effective Preview variables, including branch overrides and team-shared settings. Leave Brevo, Gmail SMTP, Resend, push VAPID, digest and production provider credentials absent. Check empty Firestore users, alerts, pushDevices and notificationLogs and preview Auth users before the scheduler-only check. Firebase Auth registration and password-reset flows can send separate verification messages and should remain unexercised until authorised.
- After deployment approval, deploy to Preview and record the exact hostname returned by Vercel. Add just that hostname under Authentication > Settings > Authorized domains in ratewatch-preview after approval. No production hostname is needed.

## Read-only health check after an approved Preview deployment

Use the exact independently verified HTTPS preview origin. Send GET /api/jobs/monitor with Authorization: Bearer plus a deliberately wrong token first, then repeat with the preview secret from the ignored local file. Keep the token in process memory, disable redirects, and print only the status and safe JSON fields. Expect 401 with the wrong token. Expect HTTP 503 with ok false and lastCompletedAt null with the correct secret on a fresh monitor record. An HTML error or an unexpected JSON shape is a failed check. Verify the Firebase identity and isolation separately. Keep the monitor POST and Cloudflare activation outside this check.
