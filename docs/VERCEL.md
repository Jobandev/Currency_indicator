# Deploy RateWatch on Vercel

Production: https://currencyindicators.vercel.app. Verified 15 November 2026.

The Vite frontend is served from dist. /api requests use api/index.ts, which exports the existing Express application without starting a listener. Other application URLs fall back to index.html.

## Automatic deployments

The Vercel project currency_indicators is connected to Jobandev/Currency_indicator on GitHub. The production branch is main. Push commits to that repository and branch to trigger a production deployment, then wait for Ready in Vercel before testing the live site.

The similarly named Jobandev/currency_indicators repository is a different repository and must not be used for this workspace. If access changes, authorize Currency_indicator in the Vercel GitHub App installation settings and reconnect under Vercel project Settings > Git.

## Create the project

Import the repository into Vercel, or deploy this directory with the Vercel CLI after login. Choose Node.js 24.x. The checked-in vercel.json supplies the build and output settings. Use Hobby only for personal, non-commercial use within its quotas; check current terms before a commercial launch.

Do not upload .env or a service-account key file. .vercelignore excludes them from CLI uploads, and .gitignore excludes them from Git.

## Environment variables

Add these public build variables using the same Firebase web app as local development:

- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_APP_ID

Add these private server variables in Vercel project settings:

- FIREBASE_PROJECT_ID
- FIREBASE_SERVICE_ACCOUNT_JSON: the complete contents of the private service-account JSON, entered only into the private environment settings.
- EMAIL_PROVIDER=brevo
- BREVO_API_KEY
- BREVO_SENDER_EMAIL: use a verified sending domain for public recipients.
- APP_URL: the exact final HTTPS origin, such as https://your-project.vercel.app.
- CRON_SECRET: a random secret of at least 32 characters.
- NODE_ENV=production
- TRUST_PROXY=1
- USE_EMULATORS=false
- VITE_USE_EMULATORS=false

Leave GOOGLE_APPLICATION_CREDENTIALS unset on Vercel: a path into your Windows Downloads folder cannot work there. Leave VITE_API_URL unset for same-origin API access. Redeploy after changing build variables.

## Firebase and launch checks

Add the final live hostname to Firebase Authentication authorized domains. Deploy the Firestore rules and indexes and wait until indexes are enabled. Confirm /api/health, public rates, direct navigation to /dashboard, Google sign-in, verification, account ownership, and a real alert email on the deployed site. Deployment protection must allow legitimate public requests and the scheduler.

## Schedule checks

Vercel Hobby cron runs at most daily, so this configuration does not register a Vercel cron job. Configure an external scheduler to POST https://YOUR_HOST/api/jobs/monitor every 15 minutes, with Authorization: Bearer YOUR_CRON_SECRET and JSON body {}. Keep the secret out of the URL. Check scheduler timeout limits and inspect repeated successful responses and monitor completion logs. The function has a 300-second maximum; use a separate worker as volume grows. No scheduler has been created by these files.

Verify the Brevo sender and domain before inviting recipients.

Sources: https://vercel.com/docs/functions/runtimes/node-js , https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing , https://vercel.com/docs/plans/hobby

## Gmail pilot sender (no custom domain)

The backend supports Gmail SMTP as an alternative to Resend. In Vercel Production environment variables set:

- EMAIL_PROVIDER=gmail
- GMAIL_USER=ratewatch510@gmail.com
- GMAIL_APP_PASSWORD: the Google App Password created by this account's owner; enter privately in Vercel, never GitHub or chat.

Enable Google 2-Step Verification first. Some managed/protected accounts do not allow App Passwords. EMAIL_FROM and RESEND_API_KEY are unused in Gmail mode. Redeploy after saving variables. Sender is always RateWatch <ratewatch510@gmail.com>, including previously queued payloads, but attempted jobs are held for review before provider migration.

Create one new alert to validate delivery after configuration. Do not assume existing Resend failures automatically migrate: attempted jobs become review_required. Inspect Resend request logs first. If the old job was definitively rejected (403), use an operator-reviewed cancellation/reconciliation before creating a replacement. Never mark failed email as sent.

Gmail SMTP does not support Resend's idempotency keys. A stable Message-ID is used but does not guarantee deduplication. Gmail failures and expired send leases are held for review instead of automatically retried; check Gmail Sent mail before manual recovery. Successful SMTP acceptance is not proof of inbox delivery. Gmail account limits and server-side sign-in restrictions apply; this option is for a small pilot, not bulk email.

References: https://nodemailer.com/usage/using-gmail/ and https://support.google.com/accounts/answer/185833
