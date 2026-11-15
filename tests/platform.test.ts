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
}));
vi.mock('../server/firebase.js', () => ({ db: fakeDb, auth: mocks, adminReady: true }));
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
