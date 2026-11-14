# Deploy RateWatch on Vercel

Prepared 15 November 2026. No deployment has been created yet.

The Vite frontend is served from dist. /api requests use api/index.ts, which exports the existing Express application without starting a listener. Other application URLs fall back to index.html.

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
- RESEND_API_KEY
- EMAIL_FROM: use a verified sending domain for public recipients.
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

The current onboarding@resend.dev sender only sends to the Resend account email. Verify a sending domain before inviting others.

Sources: https://vercel.com/docs/functions/runtimes/node-js , https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing , https://vercel.com/docs/plans/hobby
