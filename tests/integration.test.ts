import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
const rates = vi.hoisted(() => ({ latest: vi.fn() }));
vi.mock('../server/rates.js', () => ({
  getRates: rates.latest,
  getAlertRates: rates.latest,
  history: vi.fn(),
}));
describe.skipIf(!enabled)('Firebase emulator end-to-end', () => {
  let database: any;
  afterAll(async () => {
    if (database) await database.terminate();
  });
  it('register ? verify email ? login ? create alert ? trigger ? mocked send ? complete; isolates user data', async () => {
    process.env.USE_EMULATORS = 'true';
    process.env.FIREBASE_PROJECT_ID = 'demo-ratewatch';
    process.env.APP_URL = 'http://localhost:5173';
    process.env.EMAIL_FROM = 'alerts@example.test';
    const { app } = await import('../server/app');
    const { db } = await import('../server/firebase');
    database = db;
    const { enqueue, deliver } = await import('../server/monitor');
    const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/';
    async function account(method: string, body: object) {
      const response = await fetch(authBase + method + '?key=fake-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as any;
      if (!response.ok) throw new Error(JSON.stringify(result));
      return result;
    }
    const email = 'e2e-' + Date.now() + '@example.test',
      password = 'A-secure-test-password-123';
    const registered = await account('accounts:signUp', {
      email,
      password,
      returnSecureToken: true,
    });
    await account('accounts:sendOobCode', {
      requestType: 'VERIFY_EMAIL',
      idToken: registered.idToken,
    });
    const codes = (await (
      await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-ratewatch/oobCodes')
    ).json()) as any;
    const code = codes.oobCodes.find(
      (c: any) => c.email === email && c.requestType === 'VERIFY_EMAIL',
    );
    expect(code).toBeTruthy();
    await account('accounts:update', { oobCode: code.oobCode });
    const login = await account('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });
    const header = 'Bearer ' + login.idToken;
    expect((await request(app).post('/api/profile').set('Authorization', header)).status).toBe(200);
    const rate = {
      currencyPair: 'NZD/INR',
      rate: 52.8,
      provider: 'mock',
      providerTimestamp: new Date().toISOString(),
      fetchedAt: Date.now(),
    };
    rates.latest.mockResolvedValue([rate]);
    const created = await request(app)
      .post('/api/alerts')
      .set('Authorization', header)
      .send({ pair: 'NZD/INR', condition: 'gte', targetRate: 53, immediate: false });
    expect(created.status).toBe(201);
    const id = created.body.id;
    await Promise.all([enqueue(id, { ...rate, rate: 53.2 }), enqueue(id, { ...rate, rate: 53.2 })]);
    const sender = vi.fn().mockResolvedValue('test-email-id');
    await Promise.all([
      deliver('alert-' + id + '-1', sender),
      deliver('alert-' + id + '-1', sender),
    ]);
    expect(sender).toHaveBeenCalledTimes(1);
    expect((await db.collection('alerts').doc(id).get()).data()?.status).toBe('completed');
    const another = await account('accounts:signUp', {
      email: 'other-' + email,
      password,
      returnSecureToken: true,
    });
    await request(app)
      .post('/api/profile')
      .set('Authorization', 'Bearer ' + another.idToken);
    expect(
      (
        await request(app)
          .get('/api/alerts')
          .set('Authorization', 'Bearer ' + another.idToken)
      ).body,
    ).toEqual([]);
    expect(
      (
        await request(app)
          .delete('/api/alerts/' + id)
          .set('Authorization', 'Bearer ' + another.idToken)
      ).status,
    ).toBe(404);
    const firestoreUrl =
      'http://127.0.0.1:8080/v1/projects/demo-ratewatch/databases/(default)/documents/alerts/' + id;
    expect(
      (await fetch(firestoreUrl, { headers: { Authorization: 'Bearer ' + another.idToken } }))
        .status,
    ).toBe(403);
    expect((await fetch(firestoreUrl, { headers: { Authorization: header } })).status).toBe(200);
    expect(
      (
        await fetch(firestoreUrl, {
          method: 'PATCH',
          headers: { Authorization: header, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { targetRate: { doubleValue: 1 } } }),
        })
      ).status,
    ).toBe(403);
  }, 60000);
});
