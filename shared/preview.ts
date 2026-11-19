export const previewProjectId = 'ratewatch-preview';

const notificationCredentials = [
  'RESEND_API_KEY',
  'GMAIL_APP_PASSWORD',
  'VITE_FIREBASE_VAPID_KEY',
  'DIGEST_SECRET',
];

export function verifyPreviewBackend(env: NodeJS.ProcessEnv, credential: unknown) {
  if (env.VERCEL_ENV !== 'preview') return;
  if (env.FIREBASE_PROJECT_ID !== previewProjectId) {
    throw new Error('Vercel Preview requires the RateWatch preview Firebase project.');
  }
  if (
    !credential ||
    typeof credential !== 'object' ||
    !('project_id' in credential) ||
    credential.project_id !== previewProjectId ||
    !('client_email' in credential) ||
    typeof credential.client_email !== 'string' ||
    !credential.client_email.endsWith('@' + previewProjectId + '.iam.gserviceaccount.com')
  ) {
    throw new Error('Vercel Preview requires a service account from the preview Firebase project.');
  }
  if (notificationCredentials.some((key) => Boolean(env[key]))) {
    throw new Error('Notification credentials must be absent from the scheduler-only preview.');
  }
}
