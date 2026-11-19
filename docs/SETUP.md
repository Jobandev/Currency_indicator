# Local and external service setup

## Firebase

1. Open https://console.firebase.google.com/ and create a project. Start on Spark if you want hard no-billing limits; do not enable Blaze or paid cloud functions automatically.
2. Add a Web App in Project settings — General. Copy apiKey, authDomain, projectId, and appId into the four VITE_FIREBASE_ variables in .env. These identify the public Firebase app, not Admin privileges.
3. Authentication — Sign-in method: enable Email/Password and Google. Choose a support email. Add localhost and your eventual production domain to Authorized domains. Enable email enumeration protection and configure verification/password reset templates. Set a password policy of at least eight characters.
4. Firestore Database — Create database — production mode. Select an appropriate data location after considering data residency.
5. Project settings — Service accounts — Generate new private key, or use workload/application default credentials in hosting. Set FIREBASE_PROJECT_ID. If using the JSON key, put the complete compact JSON only in the server-only FIREBASE_SERVICE_ACCOUNT_JSON environment variable. Do not commit/download it into public assets. Restrict and rotate this key.
6. Deploy rules and indexes: npx firebase login, then npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID. This changes cloud configuration; run only when ready. Wait until indexes are ready before testing.
7. Set APP_URL to http://localhost:5173 locally and to your exact HTTPS origin in production. It controls CORS and email links. For one trusted proxy set TRUST_PROXY=1; do not enable it on a directly exposed server.

Firestore collections: users, alerts, exchangeRates, rateHistory (cached 30-day series), notificationLogs (outbox + receipt records), system (monitor lease/health). Timestamps are UTC epoch milliseconds except providerTimestamp (ISO date). Alert documents include the requested fields plus pair, generation, and immediate. Queue records hold private recipient payloads, lease ownership, attempts, retry time, and message ID. Client rules expose only an owner's profile/alerts; notification history goes through a filtered authenticated API.

## Brevo

1. Create a Brevo account and activate transactional sending.
2. Verify the sender and authenticate the sending domain with Brevo's SPF/DKIM guidance.
3. Create a server-only API key and set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, and `BREVO_SENDER_EMAIL`.
4. For initial testing, use one approved recipient you control and the explicit smoke-test command in `docs/SCHEDULER-AND-LIVE-TESTS.md`.
5. Register your own account, verify the Firebase email, then intentionally create an already-satisfied alert with immediate consent. Confirm provider acceptance, inbox delivery, and Brevo logs. Do not send real emails in automated tests.

Provider acceptance does not guarantee delivery; inspect bounces, spam, and transactional logs in Brevo. Gmail and Resend remain explicit local alternatives supported by the adapter, not the production default.

## Exchange-rate API

Frankfurter v2 uses https://api.frankfurter.dev/v2/rates and requires no API key. Requests are grouped into six base-currency requests for eight pairs. Recent rates are cached 15 minutes in Firestore, historical series one hour. The API origin is fixed server-side to prevent arbitrary URL fetching. An outage fails closed for new triggers while pending email retries continue. Reference timestamps and fetched timestamps are distinct. [Provider documentation](https://frankfurter.dev/).

## Emulator development

Install Java 21+ and use Node 24. Run npx firebase emulators:start --project demo-ratewatch --only auth,firestore in one terminal. In .env set FIREBASE_PROJECT_ID=demo-ratewatch, USE_EMULATORS=true, VITE_USE_EMULATORS=true, and public Firebase web values such as VITE_FIREBASE_API_KEY=demo-key, VITE_FIREBASE_AUTH_DOMAIN=demo-ratewatch.firebaseapp.com, VITE_FIREBASE_PROJECT_ID=demo-ratewatch, VITE_FIREBASE_APP_ID=demo-app. Start npm run dev. Visit http://127.0.0.1:4000 for emulator tools and verification links.

Never enable emulator variables in production. The backend rejects emulator mode with NODE_ENV=production; the frontend connects to emulators only under Vite DEV. The tests use explicit mock email senders and .test email domains, not actual mail delivery. npm run test:emulator launches isolated demo emulators, tests registration/verification/login/API creation/trigger/email acceptance/completion and security-rule isolation, then shuts them down.

### Easier local Admin key setup

Instead of copying private JSON into .env, set GOOGLE_APPLICATION_CREDENTIALS=C:/absolute/path/to/downloaded-service-account.json and leave FIREBASE_SERVICE_ACCOUNT_JSON empty. Keep the downloaded key outside the repository, use forward slashes, and restart npm run dev. Never share this file in chat or put it in frontend code. Until credentials are configured, public rates still work and account API calls return an explicit configuration error.
