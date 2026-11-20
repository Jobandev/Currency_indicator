import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { records, fakeDb } from './fake-store';
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  verifyIdToken: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  latest: vi.fn(),
  history: vi.fn(),
  sendPush: vi.fn(),
}));
vi.mock('../server/firebase.js', () => ({ db: fakeDb, auth: mocks, adminReady: true }));
vi.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEachForMulticast: mocks.sendPush }),
}));
vi.mock('../server/rates.js', () => ({
  getRates: mocks.latest,
  getAlertRates: mocks.latest,
  history: mocks.history,
}));
import { app } from '../server/app';
import { saveAlert, deleteAlert } from '../server/alerts';
import { enqueue, deliver, monitor } from '../server/monitor';
import { alertSchema, matches, type Rate, PAIRS } from '../shared/domain';
import { Frankfurter } from '../server/provider';
import { sendEmail } from '../server/email';
import { findRateExtreme, queueRateTips } from '../server/rate-tips';
const input = {
  pair: 'NZD/INR' as const,
  targetRate: 53,
  condition: 'gte' as const,
  immediate: false,
};
const rate = (): Rate => ({
  currencyPair: 'NZD/INR',
  rate: 52.8,
  provider: 'mock',
  providerTimestamp: new Date().toISOString(),
  fetchedAt: Date.now(),
});
async function make() {
  return saveAlert('alice', input, rate());
}
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('EMAIL_PROVIDER', 'resend');
  vi.restoreAllMocks();
  vi.clearAllMocks();
  records.clear();
  records.set('users/alice', {
    uid: 'alice',
    email: 'alice@example.test',
    notificationPreferences: { email: true },
  });
  records.set('users/bob', { uid: 'bob', email: 'bob@example.test' });
  mocks.getUser.mockImplementation(async (uid) => ({
    uid,
    email: uid + '@example.test',
    emailVerified: true,
  }));
  mocks.verifyIdToken.mockImplementation(async (token) => {
    if (!['alice', 'bob'].includes(token)) throw new Error('bad token');
    return { uid: token, auth_time: Date.now() / 1000 };
  });
  mocks.latest.mockResolvedValue([rate()]);
});
describe('input validation and comparison', () => {
  it.each([0, -1, NaN, Infinity, 1000001])('rejects invalid target %s', (targetRate) =>
    expect(alertSchema.safeParse({ ...input, targetRate }).success).toBe(false),
  );
  it('rejects unsupported pairs and forged ownership', () => {
    expect(alertSchema.safeParse({ ...input, pair: 'NZD/XYZ' }).success).toBe(false);
    expect(alertSchema.safeParse({ ...input, userId: 'bob' }).success).toBe(false);
  });
  it('handles equality and jumps for both directions', () => {
    expect(matches(53, 53, 'gte')).toBe(true);
    expect(matches(53.2, 53, 'gte')).toBe(true);
    expect(matches(52.8, 53, 'lte')).toBe(true);
    expect(matches(53, 53, 'lte')).toBe(true);
    expect(matches(53.1, 53, 'lte')).toBe(false);
  });
});
describe('alert mutations', () => {
  it('creates, edits, and deletes an owned alert', async () => {
    const id = await make();
    expect(records.get('alerts/' + id).status).toBe('active');
    await saveAlert('alice', { ...input, targetRate: 54 }, rate(), id);
    expect(records.get('alerts/' + id).generation).toBe(2);
    await deleteAlert('alice', id);
    expect(records.has('alerts/' + id)).toBe(false);
  });
  it('enforces three active alerts under concurrency', async () => {
    const result = await Promise.allSettled(Array.from({ length: 5 }, make));
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
  });
  it('isolates users on edit and delete', async () => {
    const id = await make();
    await expect(saveAlert('bob', input, rate(), id)).rejects.toThrow('not found');
    await expect(deleteAlert('bob', id)).rejects.toThrow('not found');
  });
  it('requires consent for already satisfied targets', async () => {
    await expect(saveAlert('alice', input, { ...rate(), rate: 54 })).rejects.toThrow(
      'already satisfied',
    );
    await expect(
      saveAlert('alice', { ...input, immediate: true }, { ...rate(), rate: 54 }),
    ).resolves.toBeTruthy();
  });
  it('rejects stale source rates', async () => {
    await expect(
      saveAlert('alice', input, { ...rate(), providerTimestamp: '2020-01-01' }),
    ).rejects.toThrow('temporarily unavailable');
  });
});
describe('durable outbox', () => {
  it('leaves monitor health and lease state to the current lease owner', async () => {
    await make();
    const replacement = { token: 'new-owner', until: Date.now() + 600000, lastCompletedAt: 1 };
    mocks.latest.mockImplementationOnce(async () => {
      records.set('system/monitor', replacement);
      return [rate()];
    });
    await expect(monitor()).resolves.toEqual({ processed: 0 });
    expect(records.get('system/monitor')).toEqual(replacement);
  });

  it('claims a jumped target once across concurrent workers', async () => {
    const id = await make();
    await Promise.all(Array.from({ length: 5 }, () => enqueue(id, { ...rate(), rate: 53.2 })));
    expect([...records.keys()].filter((k) => k.startsWith('notificationLogs/'))).toHaveLength(1);
    expect(records.get('alerts/' + id).triggeredRate).toBe(53.2);
  });
  it('sends once, completes, and permits a new generation', async () => {
    const id = await make();
    await enqueue(id, { ...rate(), rate: 53.2 });
    const key = 'alert-' + id + '-1',
      send = vi.fn().mockResolvedValue('email-1');
    await Promise.all([deliver(key, send), deliver(key, send)]);
    await deliver(key, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(records.get('alerts/' + id).status).toBe('completed');
    await saveAlert('alice', input, rate(), id);
    expect(records.get('alerts/' + id).generation).toBe(2);
  });
  it('persists retry state and reuses key and payload', async () => {
    const id = await make();
    await enqueue(id, { ...rate(), rate: 54 });
    const key = 'alert-' + id + '-1',
      send = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('email-2'),
      now = Date.now() + 1;
    await deliver(key, send, now);
    expect(records.get('notificationLogs/' + key).status).toBe('pending');
    expect(records.get('alerts/' + id).status).toBe('processing');
    await deliver(key, send, now + 1000);
    expect(send).toHaveBeenCalledTimes(1);
    await deliver(key, send, now + 61000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
    expect(records.get('alerts/' + id).status).toBe('completed');
  });
  it('holds ambiguous deliveries before idempotency expiry', async () => {
    const id = await make();
    await enqueue(id, { ...rate(), rate: 54 });
    const key = 'alert-' + id + '-1';
    records.get('notificationLogs/' + key).firstAttemptAt = Date.now() - 24 * 3600000;
    const send = vi.fn();
    await deliver(key, send);
    expect(send).not.toHaveBeenCalled();
    expect(records.get('notificationLogs/' + key).status).toBe('review_required');
  });
  it('holds Gmail failures without an automatic duplicate send', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'gmail');
    vi.stubEnv('GMAIL_USER', 'ratewatch510@gmail.com');
    const id = await make();
    await enqueue(id, { ...rate(), rate: 54 });
    const key = 'alert-' + id + '-1';
    const send = vi.fn().mockRejectedValue(new Error('timeout'));
    await deliver(key, send);
    await deliver(key, send, Date.now() + 3600000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(records.get('notificationLogs/' + key).status).toBe('review_required');
    expect(records.get('alerts/' + id).status).toBe('processing');
  });
  it('holds previously attempted Resend jobs before switching to Gmail', async () => {
    const id = await make();
    await enqueue(id, { ...rate(), rate: 54 });
    const key = 'alert-' + id + '-1';
    records.get('notificationLogs/' + key).attempts = 1;
    vi.stubEnv('EMAIL_PROVIDER', 'gmail');
    const send = vi.fn();
    await deliver(key, send);
    expect(send).not.toHaveBeenCalled();
    expect(records.get('notificationLogs/' + key).status).toBe('review_required');
  });
  it('holds expired Gmail send leases for review', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'gmail');
    vi.stubEnv('GMAIL_USER', 'ratewatch510@gmail.com');
    const id = await make();
    await enqueue(id, { ...rate(), rate: 54 });
    const key = 'alert-' + id + '-1';
    Object.assign(records.get('notificationLogs/' + key), {
      attempts: 1,
      deliveryProvider: 'gmail',
      status: 'sending',
      leaseUntil: 0,
    });
    const send = vi.fn();
    await deliver(key, send);
    expect(send).not.toHaveBeenCalled();
    expect(records.get('notificationLogs/' + key).status).toBe('review_required');
  });
  it('suppresses new triggers when notifications are disabled', async () => {
    const id = await make();
    records.get('users/alice').notificationPreferences.email = false;
    await enqueue(id, { ...rate(), rate: 54 });
    expect(records.get('alerts/' + id).status).toBe('active');
  });
  it('cancels queued mail when editing and prevents old delivery', async () => {
    const id = await make();
    await enqueue(id, { ...rate(), rate: 54 });
    await saveAlert('alice', { ...input, targetRate: 55 }, rate(), id);
    expect(records.get('alerts/' + id).generation).toBe(2);
    expect(records.get('alerts/' + id).status).toBe('active');
    const sender = vi.fn();
    await deliver('alert-' + id + '-1', sender);
    expect(sender).not.toHaveBeenCalled();
  });
  it('cancels queued mail when deleting', async () => {
    const id = await make();
    await enqueue(id, { ...rate(), rate: 54 });
    await deleteAlert('alice', id);
    expect(records.has('alerts/' + id)).toBe(false);
    expect(records.get('notificationLogs/alert-' + id + '-1').status).toBe('cancelled');
  });
  it('protects an email being sent from edits and deletion', async () => {
    const id = await make();
    await enqueue(id, { ...rate(), rate: 54 });
    records.get('notificationLogs/alert-' + id + '-1').status = 'sending';
    await expect(saveAlert('alice', input, rate(), id)).rejects.toThrow('in progress');
    await expect(deleteAlert('alice', id)).rejects.toThrow('in progress');
    expect(records.get('alerts/' + id).status).toBe('processing');
  });
  it('survives rate API failure and concurrent monitor calls', async () => {
    await make();
    mocks.latest.mockRejectedValue(new Error('provider unavailable'));
    const results = await Promise.all([monitor(), monitor()]);
    expect(results.some((r) => 'busy' in r)).toBe(true);
    expect(records.get('system/monitor').until).toBe(0);
  });
});
describe('REST authentication and authorization', () => {
  it('permits Firebase popup scripts without allowing arbitrary scripts', async () => {
    const result = await request(app).get('/api/health');
    expect(result.headers['content-security-policy']).toContain(
      "script-src 'self' https://apis.google.com",
    );
    expect(result.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  });
  it('rejects missing and invalid identity', async () => {
    expect((await request(app).get('/api/alerts')).status).toBe(401);
    expect(
      (await request(app).get('/api/alerts').set('Authorization', 'Bearer invalid')).status,
    ).toBe(401);
  });
  it('creates and reads only the current user alerts', async () => {
    expect(
      (await request(app).post('/api/alerts').set('Authorization', 'Bearer alice').send(input))
        .status,
    ).toBe(201);
    const bob = await request(app).get('/api/alerts').set('Authorization', 'Bearer bob');
    expect(bob.body).toEqual([]);
  });
  it('requires verified email', async () => {
    mocks.getUser.mockResolvedValue({ uid: 'alice', emailVerified: false });
    expect(
      (await request(app).post('/api/alerts').set('Authorization', 'Bearer alice').send(input))
        .status,
    ).toBe(403);
  });
  it('validates input on the backend', async () => {
    expect(
      (
        await request(app)
          .post('/api/alerts')
          .set('Authorization', 'Bearer alice')
          .send({ ...input, targetRate: 0 })
      ).status,
    ).toBe(400);
  });
  it('authenticates the job independently', async () => {
    expect((await request(app).post('/api/jobs/monitor')).status).toBe(401);
  });
});
describe('provider adapters', () => {
  it('groups rate requests by base and parses data', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = new URL(String(url));
      return new Response(
        JSON.stringify(
          u.searchParams
            .get('quotes')!
            .split(',')
            .map((quote) => ({
              base: u.searchParams.get('base'),
              quote,
              date: new Date().toISOString().slice(0, 10),
              rate: 1.5,
            })),
        ),
      );
    });
    const result = await new Frankfurter().latest();
    expect(result).toHaveLength(PAIRS.length);
    expect(fetch).toHaveBeenCalledTimes(new Set(PAIRS.map((p) => p.split('/')[0])).size);
  });
  it('rejects provider downtime and malformed responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('down', { status: 503 }));
    await expect(new Frankfurter().latest()).rejects.toThrow('503');
  });
  it('sends stable email idempotency header and handles failure', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'test';
    process.env.EMAIL_FROM = 'test@example.test';
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('down', { status: 503 }));
    await expect(
      sendEmail(
        {
          from: 'test@example.test',
          to: ['alice@example.test'],
          subject: 'Test',
          text: 'test',
          html: 'test',
        },
        'key',
      ),
    ).rejects.toThrow('503');
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ 'Idempotency-Key': 'key' });
  });
});

describe('missing profile recovery', () => {
  it('recreates a missing authenticated profile before saving an alert', async () => {
    records.delete('users/alice');
    const result = await request(app)
      .post('/api/alerts')
      .set('Authorization', 'Bearer alice')
      .send(input);
    expect(result.status).toBe(201);
    expect(records.get('users/alice')).toMatchObject({
      uid: 'alice',
      email: 'alice@example.test',
      emailVerified: true,
      plan: 'free',
      notificationPreferences: { email: true },
    });
  });
  it('does not reactivate an account marked for deletion', async () => {
    records.get('users/alice').deleting = true;
    const result = await request(app)
      .post('/api/alerts')
      .set('Authorization', 'Bearer alice')
      .send(input);
    expect(result.status).toBe(409);
    expect(records.get('users/alice').deleting).toBe(true);
  });
  it('preserves notification preferences and creation date when syncing', async () => {
    records.get('users/alice').notificationPreferences.email = false;
    records.get('users/alice').createdAt = 123;
    await request(app).post('/api/profile').set('Authorization', 'Bearer alice');
    expect(records.get('users/alice')).toMatchObject({
      createdAt: 123,
      notificationPreferences: { email: false },
    });
  });
});

it('explains a missing Firestore index instead of a generic service error', async () => {
  vi.spyOn(fakeDb, 'collection').mockImplementationOnce(() => {
    throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), {
      code: 9,
    });
  });
  const response = await request(app)
    .get('/api/notifications')
    .set('Authorization', 'Bearer alice');
  expect(response.status).toBe(503);
  expect(response.body.error).toContain('Firestore index setup is incomplete');
});

it('clears only the signed-in user completed updates and preserves pending mail', async () => {
  records.set('notificationLogs/done', {
    id: 'done',
    userId: 'alice',
    status: 'sent',
    createdAt: 1,
    sentAt: 2,
  });
  records.set('notificationLogs/queued', {
    id: 'queued',
    userId: 'alice',
    status: 'pending',
    createdAt: 1,
  });
  records.set('notificationLogs/other', {
    id: 'other',
    userId: 'bob',
    status: 'sent',
    createdAt: 1,
  });
  mocks.verifyIdToken.mockResolvedValue({ uid: 'alice' });
  expect(
    (await request(app).post('/api/notifications/clear').set('Authorization', 'Bearer valid'))
      .status,
  ).toBe(200);
  const response = await request(app)
    .get('/api/notifications')
    .set('Authorization', 'Bearer valid');
  expect(response.body.map((n: { id: string }) => n.id)).toEqual(['queued']);
  expect(records.get('users/bob').notificationsClearedAt).toBeUndefined();
  expect(records.get('notificationLogs/done').status).toBe('sent');
});

it('dismisses only owned completed notifications and preserves their delivery record', async () => {
  mocks.verifyIdToken.mockResolvedValue({ uid: 'alice' });
  records.set('notificationLogs/done', {
    id: 'done',
    userId: 'alice',
    status: 'sent',
    createdAt: 1,
  });
  records.set('notificationLogs/pending', {
    id: 'pending',
    userId: 'alice',
    status: 'pending',
    createdAt: 1,
  });
  records.set('notificationLogs/other', {
    id: 'other',
    userId: 'bob',
    status: 'sent',
    createdAt: 1,
  });
  const remove = (id: string) =>
    request(app)
      .delete('/api/notifications/' + id)
      .set('Authorization', 'Bearer valid');
  expect((await remove('done')).status).toBe(200);
  expect(records.get('notificationLogs/done').dismissed).toBe(true);
  expect(records.get('notificationLogs/done').status).toBe('sent');
  expect((await remove('pending')).status).toBe(409);
  expect((await remove('other')).status).toBe(404);
  const response = await request(app)
    .get('/api/notifications')
    .set('Authorization', 'Bearer valid');
  expect(response.body.map((n: { id: string }) => n.id)).toEqual(['pending']);
});

it('supports featured cross-currency alerts and sends their pairs to monitoring', async () => {
  expect(alertSchema.safeParse({ ...input, pair: 'NZD/JPY' }).success).toBe(true);
  expect(alertSchema.safeParse({ ...input, pair: 'USD/USD' }).success).toBe(false);
  const cross = { ...rate(), currencyPair: 'NZD/JPY', rate: 90 };
  const id = await saveAlert('alice', { ...input, pair: 'NZD/JPY', targetRate: 100 }, cross);
  mocks.latest.mockResolvedValue([cross]);
  await monitor();
  expect(mocks.latest).toHaveBeenCalledWith(['NZD/JPY']);
  expect(records.get('alerts/' + id).status).toBe('active');
});

it('pauses only an owned alert and resumes with a new generation within the active limit', async () => {
  const id = await make();
  const path = '/api/alerts/' + id;
  await request(app)
    .patch(path)
    .set('Authorization', 'Bearer bob')
    .send({ paused: true })
    .expect(404);
  await request(app)
    .patch(path)
    .set('Authorization', 'Bearer alice')
    .send({ paused: true })
    .expect(200);
  await enqueue(id, { ...rate(), rate: 54 });
  expect(records.get('alerts/' + id).status).toBe('paused');
  expect(records.has('notificationLogs/alert-' + id + '-1')).toBe(false);
  const active = await Promise.all([make(), make(), make()]);
  await request(app)
    .patch(path)
    .set('Authorization', 'Bearer alice')
    .send({ paused: false })
    .expect(409);
  await deleteAlert('alice', active[0]);
  await request(app)
    .patch(path)
    .set('Authorization', 'Bearer alice')
    .send({ paused: false })
    .expect(200);
  expect(records.get('alerts/' + id)).toMatchObject({ status: 'active', generation: 2 });
});

it('never evaluates an intraday alert against a daily reference observation', async () => {
  const id = await saveAlert(
    'alice',
    { ...input, rateSource: 'intraday' },
    {
      ...rate(),
      kind: 'intraday',
    },
  );
  await enqueue(id, { ...rate(), rate: 54 });
  expect(records.get('alerts/' + id).status).toBe('active');
  await enqueue(id, { ...rate(), kind: 'intraday', rate: 54 });
  expect(records.get('alerts/' + id).observation.kind).toBe('intraday');
});

it('validates custom history ranges before contacting Frankfurter', async () => {
  mocks.history.mockResolvedValue([]);
  await request(app).get('/api/history?pair=NZD%2FINR&from=2000-01-01&to=2024-01-01').expect(400);
  expect(mocks.history).not.toHaveBeenCalled();
  await request(app).get('/api/history?pair=NZD%2FINR&from=2023-04-01&to=2024-01-01').expect(200);
  expect(mocks.history).toHaveBeenCalledWith('NZD/INR', '2023-04-01', '2024-01-01');
});

it('queues one opted-in summary and honours its signed unsubscribe link', async () => {
  const { queueDigests } = await import('../server/digests');
  const now = Date.parse('2026-11-02T08:00:00Z');
  vi.stubEnv('DIGEST_SECRET', 'test-digest-secret-with-at-least-32-characters');
  vi.stubEnv('APP_URL', 'https://ratewatch.example');
  Object.assign(records.get('users/alice'), {
    emailVerified: true,
    digestFrequency: 'weekly',
    digestPair: 'NZD/INR',
    digestDueAt: now - 1,
  });
  mocks.history.mockResolvedValue([{ date: '2026-10-30', rate: 52 }]);
  await Promise.all([queueDigests(now), queueDigests(now)]);
  const jobs = [...records.entries()].filter(([path]) =>
    path.startsWith('notificationLogs/digest-'),
  );
  expect(jobs).toHaveLength(1);
  const [path, job] = jobs[0];
  const match = job.payload.text.match(/#([\w-]+)\.([\w-]+)/);
  expect(match).not.toBeNull();
  const [, value, signature] = match;
  await request(app)
    .post('/api/digests/unsubscribe')
    .send({ value, signature: signature.slice(1) })
    .expect(400);
  await request(app).post('/api/digests/unsubscribe').send({ value, signature }).expect(200);
  expect(records.get('users/alice').digestFrequency).toBe('off');
  const sender = vi.fn();
  await deliver(path.split('/').at(-1)!, sender, now);
  expect(sender).not.toHaveBeenCalled();
  expect(records.get(path).status).toBe('cancelled');
});

const tipDate = Date.parse('2026-11-20T10:00:00Z');
const tipHistory = (latest: number) =>
  Array.from({ length: 20 }, (_, index) => ({
    date: new Date(tipDate - (19 - index) * 86400000).toISOString().slice(0, 10),
    rate: index === 19 ? latest : index % 2 ? 49 : 51,
  }));

it('only flags fresh, distinct reference highs or lows', () => {
  expect(findRateExtreme(tipHistory(52), tipDate)?.direction).toBe('high');
  expect(findRateExtreme(tipHistory(48), tipDate)?.direction).toBe('low');
  expect(findRateExtreme(tipHistory(51), tipDate)).toBeNull();
  expect(findRateExtreme(tipHistory(52).slice(-10), tipDate)).toBeNull();
  expect(findRateExtreme(tipHistory(52), tipDate + 4 * 86400000)).toBeNull();
});

it('queues at most one high or low email per month for an opted-in user without a target', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(tipDate);
  vi.stubEnv('APP_URL', 'https://ratewatch.example');
  vi.stubEnv('NOTIFICATION_DELIVERY_DISABLED', 'true');
  const preferences = (rateTips: boolean) =>
    request(app)
      .patch('/api/profile')
      .set('Authorization', 'Bearer alice')
      .send({ name: 'Alice', email: true, rateTips, rateTipPair: 'NZD/INR' });
  await preferences(true).expect(200);
  mocks.history.mockResolvedValue(tipHistory(50));
  await queueRateTips(tipDate);
  expect(records.get('notificationLogs/rate-tip-alice-2026-11')).toBeUndefined();
  expect(mocks.history).toHaveBeenCalledTimes(1);
  await queueRateTips(tipDate);
  expect(mocks.history).toHaveBeenCalledTimes(1);

  const tomorrow = tipDate + 86400000;
  mocks.history.mockResolvedValue([...tipHistory(50), { date: '2026-11-21', rate: 52 }]);
  await Promise.all([queueRateTips(tomorrow), queueRateTips(tomorrow)]);
  const jobId = 'rate-tip-alice-2026-11';
  const jobPath = 'notificationLogs/' + jobId;
  const job = records.get(jobPath);
  expect(job.payload.subject).toBe('NZD/INR reached a new 30-day high');
  expect(job.payload.text).toContain('/alerts/new?pair=NZD%2FINR');
  expect([...records.keys()].filter((path) => path.startsWith('notificationLogs/'))).toEqual([
    jobPath,
  ]);
  const sender = vi.fn();
  await deliver(jobId, sender, tomorrow);
  expect(sender).not.toHaveBeenCalled();
  expect(records.get(jobPath).status).toBe('pending');
  vi.stubEnv('NOTIFICATION_DELIVERY_DISABLED', 'false');
  await preferences(false).expect(200);
  await deliver(jobId, sender, tomorrow);
  expect(sender).not.toHaveBeenCalled();
  expect(records.get(jobPath).status).toBe('cancelled');
});

it('requires an enabled device to save a push alert and holds it active after opt-out', async () => {
  const path = '/api/alerts';
  const token = 'test-registration-token-for-this-device';
  const send = (body: object) =>
    request(app).post(path).set('Authorization', 'Bearer alice').send(body);
  await send({ ...input, channel: 'push' }).expect(409);
  const setDevice = (enabled: boolean) =>
    request(app)
      .put('/api/push-device')
      .set('Authorization', 'Bearer alice')
      .send({ token, enabled });
  await setDevice(true).expect(200);
  await request(app)
    .get('/api/push-device')
    .set('Authorization', 'Bearer alice')
    .expect(200, { enabled: true });
  await request(app)
    .get('/api/push-device')
    .set('Authorization', 'Bearer bob')
    .expect(200, { enabled: false });
  const {
    body: { id },
  } = await send({ ...input, channel: 'push' }).expect(201);
  await setDevice(false).expect(200);
  await request(app)
    .get('/api/push-device')
    .set('Authorization', 'Bearer alice')
    .expect(200, { enabled: false });
  await enqueue(id, { ...rate(), rate: 54 });
  expect(records.get('alerts/' + id).status).toBe('active');
});

it.each(['email', 'push'] as const)(
  'keeps Production Send now %s pending when notification delivery is disabled',
  async (channel) => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NOTIFICATION_DELIVERY_DISABLED', 'true');
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'sender@example.test');
    const email = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ id: 'mock-resend-message' }));
    mocks.sendPush.mockResolvedValue({ successCount: 1, responses: [{ success: true }] });
    await request(app)
      .put('/api/push-device')
      .set('Authorization', 'Bearer alice')
      .send({ token: 'test-registration-token-123456789', enabled: true })
      .expect(200);
    mocks.latest.mockResolvedValue([{ ...rate(), rate: 54 }]);

    const { body } = await request(app)
      .post('/api/alerts')
      .set('Authorization', 'Bearer alice')
      .send({ ...input, immediate: true, channel })
      .expect(201);
    const job = 'notificationLogs/alert-' + body.id + '-1';
    expect(records.get(job)).toMatchObject({ status: 'pending', attempts: 0, leaseUntil: 0 });
    await expect(monitor()).resolves.toEqual({ processed: 0 });
    expect(records.get(job)).toMatchObject({ status: 'pending', attempts: 0, leaseUntil: 0 });
    expect(email).not.toHaveBeenCalled();
    expect(mocks.sendPush).not.toHaveBeenCalled();
  },
);

it('keeps Vercel Production delivery paused when the setting is absent', async () => {
  const id = await make();
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('NOTIFICATION_DELIVERY_DISABLED', undefined);
  await enqueue(id, { ...rate(), rate: 54 });
  const jobId = 'alert-' + id + '-1';
  const sender = vi.fn();
  await deliver(jobId, sender);
  expect(sender).not.toHaveBeenCalled();
  expect(records.get('notificationLogs/' + jobId).status).toBe('pending');
});

it('keeps push moving past old email jobs when email delivery is off', async () => {
  vi.stubEnv('EMAIL_PROVIDER', 'off');
  await request(app)
    .post('/api/alerts')
    .set('Authorization', 'Bearer alice')
    .send(input)
    .expect(503);
  records.set('pushDevices/test', { userId: 'alice', token: 'fake-device-token' });
  const id = await saveAlert('alice', { ...input, channel: 'push' }, rate());
  await enqueue(id, { ...rate(), rate: 54 });
  for (let i = 0; i < 101; i++) {
    records.set('notificationLogs/old-' + i, {
      status: 'pending',
      notificationType: 'email',
      attempts: 0,
      nextAttemptAt: 0,
    });
  }
  mocks.sendPush.mockResolvedValue({ successCount: 1, responses: [{ success: true }] });
  await expect(monitor()).resolves.toEqual({ processed: 1 });
  expect(mocks.sendPush).toHaveBeenCalledOnce();
  expect(records.get('notificationLogs/old-100').attempts).toBe(0);
});

it('queues Preview push without sending and completes through mocked FCM outside Preview', async () => {
  const tokens = ['valid-registration-token-example', 'expired-registration-token-example'];
  for (const token of tokens) {
    await request(app)
      .put('/api/push-device')
      .set('Authorization', 'Bearer alice')
      .send({ token, enabled: true })
      .expect(200);
  }
  const id = await saveAlert('alice', { ...input, channel: 'push' }, rate());
  const jobId = 'alert-' + id + '-1';
  vi.stubEnv('VERCEL_ENV', 'preview');
  mocks.latest.mockResolvedValue([{ ...rate(), rate: 54 }]);
  await expect(monitor()).resolves.toEqual({ processed: 0 });
  await deliver(jobId);
  expect(mocks.sendPush).not.toHaveBeenCalled();
  expect(records.get('notificationLogs/' + jobId).status).toBe('pending');

  vi.unstubAllEnvs();
  mocks.sendPush.mockResolvedValue({
    successCount: 1,
    responses: [
      { success: true, messageId: 'fake-fcm-message' },
      { success: false, error: { code: 'messaging/registration-token-not-registered' } },
    ],
  });
  await deliver(jobId);
  expect(mocks.sendPush).toHaveBeenCalledExactlyOnceWith({
    tokens,
    data: { path: '/dashboard#alert-' + id, tag: jobId },
    webpush: { headers: { TTL: '3600', Urgency: 'high' } },
  });
  expect(records.get('alerts/' + id).status).toBe('completed');
  expect([...records.values()].some((record) => record.token === tokens[1])).toBe(false);
});

it('delivers email and push independently for one crossing and then rearms', async () => {
  records.set('pushDevices/dual-test', { userId: 'alice', token: 'fake-dual-token' });
  mocks.sendPush.mockResolvedValue({
    successCount: 1,
    responses: [{ success: true, messageId: 'fake-push' }],
  });
  const point = { ...rate(), rate: input.targetRate };
  const id = await saveAlert(
    'alice',
    { ...input, channel: 'both', repeat: true, immediate: true },
    point,
  );
  const key = 'alert-' + id + '-1';
  const sender = vi.fn().mockResolvedValue('fake-email');
  await enqueue(id, point);
  await deliver(key, sender);
  expect(records.get('alerts/' + id).status).toBe('processing');
  await deliver(key + '-push');
  await deliver(key, sender);
  expect(sender).toHaveBeenCalledTimes(1);
  expect(mocks.sendPush).toHaveBeenCalledTimes(1);
  expect(records.get('alerts/' + id)).toMatchObject({
    status: 'active',
    waitingForReset: true,
    generation: 2,
  });
});

it.each(['gte', 'lte'] as const)(
  'keeps recurring push alerts active and sends once per fresh %s crossing',
  async (condition) => {
    const now = Date.now();
    const outside = condition === 'gte' ? 52 : 54;
    const inside = condition === 'gte' ? 54 : 52;
    const point = (value: number, minutesAgo: number) => ({
      ...rate(),
      rate: value,
      providerTimestamp: new Date(now - minutesAgo * 60000).toISOString(),
    });
    records.set('pushDevices/repeat-test', { userId: 'alice', token: 'fake-recurring-token' });
    mocks.sendPush.mockResolvedValue({
      successCount: 1,
      responses: [{ success: true, messageId: 'fake-recurring-message' }],
    });
    const id = await saveAlert(
      'alice',
      { ...input, condition, channel: 'push', repeat: true },
      point(outside, 6),
    );
    const first = point(inside, 5);
    await Promise.all([enqueue(id, first), enqueue(id, first)]);
    await deliver('alert-' + id + '-1');
    expect(mocks.sendPush).toHaveBeenCalledTimes(1);
    expect(records.get('alerts/' + id)).toMatchObject({
      status: 'active',
      waitingForReset: true,
      generation: 2,
    });
    await enqueue(id, point(inside, 4));
    await enqueue(id, point(outside, 6)); // A stale observation cannot rearm the alert.
    await enqueue(id, point(inside, 3));
    await enqueue(id, point(outside, 4));
    await enqueue(id, point(inside, 3));
    expect(records.has('notificationLogs/alert-' + id + '-2')).toBe(false);
    await enqueue(id, point(outside, 2));
    expect(records.get('alerts/' + id).waitingForReset).toBe(false);
    await enqueue(id, point(inside, 1));
    await deliver('alert-' + id + '-2');
    expect(mocks.sendPush).toHaveBeenCalledTimes(2);
  },
);

it('can start watching a recurring push alert inside the target without sending immediately', async () => {
  const id = await saveAlert(
    'alice',
    { ...input, channel: 'push', repeat: true },
    { ...rate(), rate: 54 },
  );
  expect(records.get('alerts/' + id)).toMatchObject({ status: 'active', waitingForReset: true });
  expect([...records.keys()].some((path) => path.startsWith('notificationLogs/'))).toBe(false);
});

it('keeps a recurring alert active after an uncertain push and does not retry that crossing', async () => {
  const now = Date.now();
  const earlier = { ...rate(), providerTimestamp: new Date(now - 60000).toISOString() };
  records.set('pushDevices/repeat-test', { userId: 'alice', token: 'fake-recurring-token' });
  const id = await saveAlert('alice', { ...input, channel: 'push', repeat: true }, earlier);
  const crossing = { ...rate(), rate: 54 };
  await enqueue(id, crossing);
  mocks.sendPush.mockRejectedValue(new Error('Uncertain provider outcome'));
  const job = 'alert-' + id + '-1';
  await deliver(job);
  await enqueue(id, crossing);
  await deliver(job);
  expect(mocks.sendPush).toHaveBeenCalledTimes(1);
  expect(records.get('notificationLogs/' + job).status).toBe('review_required');
  expect(records.get('alerts/' + id)).toMatchObject({
    status: 'active',
    waitingForReset: true,
    generation: 2,
  });
});

it('evaluates intraday alerts even when the daily provider fails', async () => {
  await make();
  const observation: Rate = { ...rate(), kind: 'intraday', provider: 'exchangerate.dev' };
  const id = await saveAlert('alice', { ...input, rateSource: 'intraday' }, observation);
  mocks.latest.mockImplementation(async (_pairs, source) => {
    if (source !== 'intraday') throw new Error('Reference provider down');
    return [{ ...observation, rate: 54 }];
  });
  vi.stubEnv('EMAIL_PROVIDER', 'resend');
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_FROM', 'RateWatch <sender@example.test>');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'accepted' }));
  expect(await monitor()).toMatchObject({ rateError: true });
  expect(records.get('alerts/' + id).status).toBe('completed');
});

it('exposes recent monitor health only to the scheduler credential', async () => {
  const secret = 'test-secret-'.repeat(3);
  vi.stubEnv('CRON_SECRET', secret);
  const path = '/api/jobs/monitor';
  await request(app).get(path).expect(401);
  const check = () =>
    request(app)
      .get(path)
      .set('Authorization', 'Bearer ' + secret);
  await check().expect(503).expect('Cache-Control', 'no-store');
  records.set('system/monitor', {
    lastCompletedAt: Date.now(),
    lastRatesOk: true,
    token: 'private',
  });
  await check()
    .expect(200)
    .expect(({ body }) => {
      expect(body).toMatchObject({ ok: true, lastRatesOk: true });
      expect(body).not.toHaveProperty('token');
    });
  records.set('system/monitor', { lastCompletedAt: Date.now() - 16 * 60000, lastRatesOk: true });
  await check().expect(503);
});

it('shares the intraday poll budget across overlapping ticks and clamps the interval to 30 minutes', async () => {
  const { refreshIntraday } = await import('../server/intraday');
  const now = Date.now();
  vi.stubEnv('EXCHANGERATE_DEV_API_KEY', 'test-key');
  vi.stubEnv('RATE_MONITOR_INTERVAL_MINUTES', '5');
  const upstream = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    Response.json({
      base: 'USD',
      result: 'success',
      rates: {},
      effective_at: {},
      sources: {},
      stale: {},
    }),
  );
  await Promise.all([refreshIntraday(now), refreshIntraday(now)]);
  await refreshIntraday(now + 5 * 60000);
  await refreshIntraday(now + 29 * 60000);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream).toHaveBeenCalledWith(
    expect.stringContaining('/v1/latest/USD?symbols='),
    expect.objectContaining({
      headers: { Authorization: 'Bearer test-key' },
    }),
  );
  await refreshIntraday(now + 30 * 60000);
  expect(upstream).toHaveBeenCalledTimes(2);
});
