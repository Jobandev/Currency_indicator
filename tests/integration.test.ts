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
    const { deliver } = await import('../server/monitor');
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
    const cronSecret = 'emulator-only-monitor-secret'.repeat(2);
    vi.stubEnv('CRON_SECRET', cronSecret);
    const monitorPath = '/api/jobs/monitor';
    const tick = () =>
      request(app)
        .post(monitorPath)
        .set('Authorization', 'Bearer ' + cronSecret);
    await request(app).post(monitorPath).expect(401);
    await tick().expect(200, { processed: 0 });
    expect((await database.collection('system').doc('monitor').get()).data()).toMatchObject({
      lastRatesOk: true,
      until: 0,
    });
    expect((await database.collection('alerts').doc(id).get()).data()?.status).toBe('active');
    const sender = vi.fn().mockResolvedValue('test-email-id');
    const jobId = 'alert-' + id + '-1';
    const job = db.collection('notificationLogs').doc(jobId);
    vi.stubEnv('VERCEL_ENV', 'preview');
    try {
      rates.latest.mockResolvedValue([{ ...rate, rate: 53.2 }]);
      await tick().expect(200, { processed: 0 });
      await tick().expect(200, { processed: 0 });
      await deliver(jobId, sender);
      expect(sender).not.toHaveBeenCalled();
      expect((await db.collection('alerts').doc(id).get()).data()?.status).toBe('processing');
      expect((await job.get()).data()).toMatchObject({ status: 'pending', attempts: 0 });
      await request(app)
        .get(monitorPath)
        .set('Authorization', 'Bearer ' + cronSecret)
        .expect(200);
    } finally {
      vi.unstubAllEnvs();
    }
    await Promise.all([deliver(jobId, sender), deliver(jobId, sender)]);
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
    const route = '/api/transfer-plans';
    const otherHeader = 'Bearer ' + another.idToken;
    const input = { pair: 'NZD/INR', amount: 500, targetRate: 53, alertId: id };
    expect((await request(app).get(route)).status).toBe(401);
    expect(
      (await request(app).post(route).set('Authorization', otherHeader).send(input)).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(route)
          .set('Authorization', header)
          .send({ ...input, pair: 'AUD/INR' })
      ).status,
    ).toBe(400);
    const plan = await request(app).post(route).set('Authorization', header).send(input);
    expect(plan.status).toBe(201);
    expect(plan.body).toMatchObject(input);
    const planRoute = route + '/' + plan.body.id;
    expect((await request(app).get(route).set('Authorization', otherHeader)).body).toEqual([]);
    expect(
      (
        await request(app)
          .put(planRoute)
          .set('Authorization', otherHeader)
          .send({ ...input, alertId: null })
      ).status,
    ).toBe(404);
    expect((await request(app).delete(planRoute).set('Authorization', otherHeader)).status).toBe(
      404,
    );
    expect(
      (
        await request(app)
          .put(planRoute)
          .set('Authorization', header)
          .send({ ...input, amount: 600 })
      ).status,
    ).toBe(200);
    expect((await request(app).get(route).set('Authorization', header)).body).toMatchObject([
      { ...input, amount: 600 },
    ]);
    const planUrl = firestoreUrl.replace('/alerts/' + id, '/transferPlans/' + plan.body.id);
    expect((await fetch(planUrl, { headers: { Authorization: header } })).status).toBe(403);
    expect((await request(app).delete(planRoute).set('Authorization', header)).status).toBe(200);
    expect((await request(app).get(route).set('Authorization', header)).body).toEqual([]);
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
