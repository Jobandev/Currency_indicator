import { verifyPreviewBackend } from '../shared/preview.js';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
if (process.env.USE_EMULATORS === 'true') {
  if (process.env.NODE_ENV === 'production') throw new Error('Emulators forbidden in production');
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : undefined;
verifyPreviewBackend(process.env, serviceAccount);
initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'demo-ratewatch',
  credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
});
export const db = getFirestore();
export const auth = getAuth();

// Development must not start Firestore RPCs without credentials: the gRPC library can reject outside the request handler.
export const adminReady =
  process.env.USE_EMULATORS === 'true' ||
  !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (!!process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) ||
  existsSync(
    join(
      process.env.APPDATA || join(homedir(), '.config'),
      'gcloud',
      'application_default_credentials.json',
    ),
  ) ||
  process.env.NODE_ENV === 'production';
