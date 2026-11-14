import { expect, it, vi } from 'vitest';
import request from 'supertest';
const state = vi.hoisted(() => ({ collection: vi.fn(), verifyIdToken: vi.fn() }));
vi.mock('../server/firebase.js', () => ({
  adminReady: false,
  db: { collection: state.collection },
  auth: { verifyIdToken: state.verifyIdToken },
}));
vi.mock('../server/provider.js', () => ({
  Frankfurter: class {
    async latest() {
      return [
        'NZD/INR',
        'AUD/INR',
        'USD/INR',
        'NZD/USD',
        'USD/NZD',
        'GBP/INR',
        'EUR/INR',
        'CAD/INR',
      ].map((currencyPair) => ({
        currencyPair,
        rate: 1,
        provider: 'mock',
        providerTimestamp: new Date().toISOString(),
        fetchedAt: Date.now(),
      }));
    }
  },
}));
import { app } from '../server/app';
it('returns a clear missing-credential response without accessing Firebase', async () => {
  const response = await request(app).get('/api/alerts').set('Authorization', 'Bearer test');
  expect(response.status).toBe(503);
  expect(response.body.error).toContain('GOOGLE_APPLICATION_CREDENTIALS');
  expect(state.verifyIdToken).not.toHaveBeenCalled();
});
it('serves public rates without attempting an unconfigured database RPC', async () => {
  process.env.FIREBASE_PROJECT_ID = 'demo-ratewatch';
  const response = await request(app).get('/api/rates');
  expect(response.status).toBe(200);
  expect(response.body).toHaveLength(8);
  expect(state.collection).not.toHaveBeenCalled();
});
