import { expect, it } from 'vitest';
import { verifyPreviewBackend } from '../shared/preview';

const env = { VERCEL_ENV: 'preview', FIREBASE_PROJECT_ID: 'ratewatch-preview' };
const credential = {
  project_id: 'ratewatch-preview',
  client_email: 'preview@ratewatch-preview.iam.gserviceaccount.com',
};

it('requires a matching preview project and explicit preview Admin credentials', () => {
  expect(() => verifyPreviewBackend(env, credential)).not.toThrow();
  expect(() =>
    verifyPreviewBackend({ ...env, FIREBASE_PROJECT_ID: 'indicator-6bf61' }, credential),
  ).toThrow();
  expect(() =>
    verifyPreviewBackend(env, { ...credential, project_id: 'indicator-6bf61' }),
  ).toThrow();
  expect(() => verifyPreviewBackend(env, undefined)).toThrow();
});

it('blocks outbound notification credentials in preview without applying the preview guard to production', () => {
  expect(() => verifyPreviewBackend({ ...env, BREVO_API_KEY: 'fake-key' }, credential)).toThrow();
  expect(() => verifyPreviewBackend({ ...env, VERCEL_ENV: 'production' }, undefined)).not.toThrow();
});
