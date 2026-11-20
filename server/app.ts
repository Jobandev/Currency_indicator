import { intradayConfigured } from './intraday.js';
import { digestSchedule, unsubscribeDigest } from './digests.js';
import { pushDevicesFor, setPushDevice } from './push.js';
import { currencies, worldRates } from './world.js';
import { syncProfile } from './profile.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { auth, db, adminReady } from './firebase.js';
import {
  alertSchema,
  CURRENCY_CODES,
  fresh,
  PAIRS,
  pairSchema,
  transferPlanSchema,
} from '../shared/domain.js';
import { emailProvider } from './email.js';
import { getRates, getAlertRates, history } from './rates.js';
import { HttpError, saveAlert, deleteAlert, setAlertPaused } from './alerts.js';
import { monitor, enqueue, deliver, log } from './monitor.js';
export const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", 'https://apis.google.com'],
        'connect-src': [
          "'self'",
          'https://*.googleapis.com',
          'https://*.firebaseapp.com',
          'https://*.firebaseio.com',
        ],
        'frame-src': ['https://*.firebaseapp.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(cors({ origin: process.env.APP_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '8kb' }));
app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    configured: !!process.env.FIREBASE_PROJECT_ID && adminReady,
    emailEnabled: emailProvider() !== 'off',
    intradayEnabled: adminReady && intradayConfigured(),
  }),
);
const authorizeMonitor: express.RequestHandler = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET,
    got = req.headers.authorization || '',
    want = 'Bearer ' + secret;
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(got) !== Buffer.byteLength(want) ||
    !timingSafeEqual(Buffer.from(got), Buffer.from(want))
  )
    throw new HttpError(401, 'Unauthorized');
  if (!adminReady)
    throw new HttpError(
      503,
      'Firebase Admin is not configured. Set GOOGLE_APPLICATION_CREDENTIALS in .env to your downloaded service-account JSON file, then restart npm run dev.',
    );
  next();
};
app.get('/api/jobs/monitor', authorizeMonitor, async (_req, res) => {
  const state = (await db.collection('system').doc('monitor').get()).data();
  const lastCompletedAt = typeof state?.lastCompletedAt === 'number' ? state.lastCompletedAt : null;
  const ok =
    lastCompletedAt !== null &&
    lastCompletedAt <= Date.now() &&
    Date.now() - lastCompletedAt <= 15 * 60000 &&
    state?.lastRatesOk === true;
  res.status(ok ? 200 : 503).json({ ok, lastCompletedAt, lastRatesOk: state?.lastRatesOk ?? null });
});
app.post('/api/jobs/monitor', authorizeMonitor, async (_req, res) => {
  const result = await monitor();
  res.status('rateError' in result ? 503 : 200).json(result);
});
app.use(
  '/api',
  rateLimit({ windowMs: 60000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false }),
);
app.get('/api/currencies', async (_req, res) => res.json(await currencies()));
app.get('/api/world-rates', async (req, res) => {
  const base = z
    .string()
    .regex(/^[A-Z]{3}$/)
    .parse(req.query.base);
  if (!(await currencies()).some((c) => c.code === base))
    throw new HttpError(400, 'Unsupported base currency');
  if (req.query.source === 'market') {
    res.set('Cache-Control', 'no-store');
    if (!intradayConfigured() || !adminReady || !CURRENCY_CODES.some((code) => code === base))
      return res.json([]);
    const rates = await getAlertRates(
      CURRENCY_CODES.filter((code) => code !== base).map((code) => base + '/' + code),
      'intraday',
    );
    return res.json(rates.filter((rate) => fresh(rate)));
  }
  res.json(await worldRates(base));
});
app.get('/api/observed-rate', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const pair = pairSchema.parse(req.query.pair);
  if (!adminReady || !intradayConfigured()) return res.json(null);
  const [rate] = await getAlertRates([pair], 'intraday');
  return res.json(rate && fresh(rate) ? rate : null);
});
app.get('/api/rates', async (_req, res) => res.json(await getRates()));
app.get('/api/history', async (req, res) => {
  const pair = pairSchema.parse(req.query.pair);
  const today = new Date().toISOString().slice(0, 10);
  const range = z
    .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
    .parse(req.query);
  const end = range.to || today;
  if (
    (!range.from && range.to) ||
    end > today ||
    (range.from && (range.from > end || Date.parse(end) - Date.parse(range.from) > 1830 * 86400000))
  ) {
    throw new HttpError(400, 'Choose a date range of up to five years ending today or earlier.');
  }
  res.json(await history(pair, range.from, end));
});
app.post('/api/digests/unsubscribe', async (req, res) => {
  const { value, signature } = z
    .object({ value: z.string().regex(/^[\w-]{1,256}$/), signature: z.string().max(43) })
    .strict()
    .parse(req.body);
  if (!(await unsubscribeDigest(value, signature)))
    throw new HttpError(400, 'Invalid unsubscribe link');
  res.json({ ok: true });
});
app.use('/api', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!adminReady)
    throw new HttpError(
      503,
      'Firebase Admin is not configured. Set GOOGLE_APPLICATION_CREDENTIALS in .env to your downloaded service-account JSON file, then restart npm run dev.',
    );
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in');
  try {
    const token = await auth.verifyIdToken(header.slice(7), true);
    res.locals.uid = token.uid;
    res.locals.token = token;
  } catch {
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }
  next();
});
app.put('/api/push-device', async (req, res) => {
  const input = z
    .object({ token: z.string().min(30).max(4096), enabled: z.boolean() })
    .strict()
    .parse(req.body);
  await setPushDevice(res.locals.uid, input.token, input.enabled);
  res.json({ ok: true });
});
app.get('/api/push-device', async (_req, res) => {
  const devices = await pushDevicesFor(res.locals.uid).limit(1).get();
  res.set('Cache-Control', 'no-store');
  res.json({ enabled: !devices.empty });
});
app.post('/api/profile', async (_req, res) => {
  const user = await auth.getUser(res.locals.uid);
  await syncProfile(user);
  res.json({ ok: true });
});
app.get('/api/profile', async (_req, res) =>
  res.json((await db.collection('users').doc(res.locals.uid).get()).data() || {}),
);
app.patch('/api/profile', async (req, res) => {
  await syncProfile(await auth.getUser(res.locals.uid));
  const input = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.boolean(),
        digestFrequency: z.enum(['off', 'weekly', 'monthly']).optional(),
        digestPair: pairSchema.optional(),
        rateTips: z.boolean().optional(),
        rateTipPair: z.enum(PAIRS).optional(),
      })
      .strict()
      .parse(req.body),
    ref = db.collection('users').doc(res.locals.uid);
  await db.runTransaction(async (t) => {
    const u = await t.get(ref);
    if (!u.exists || u.data()!.deleting) throw new HttpError(409, 'Account unavailable');
    const profile = u.data()!;
    const rateTips = input.rateTips ?? profile.rateTips === true;
    const rateTipPair = input.rateTipPair ?? profile.rateTipPair ?? 'NZD/INR';
    const rateTipDueAt =
      rateTips && input.email
        ? profile.rateTipPair === rateTipPair && profile.rateTipDueAt
          ? profile.rateTipDueAt
          : Date.now()
        : null;
    t.update(ref, {
      name: input.name,
      'notificationPreferences.email': input.email,
      ...(input.digestFrequency !== undefined && { digestFrequency: input.digestFrequency }),
      ...(input.digestFrequency === 'off' && { digestDueAt: null }),
      ...(input.digestFrequency &&
        input.digestFrequency !== 'off' &&
        (input.digestFrequency !== u.data()?.digestFrequency || !u.data()?.digestDueAt) && {
          digestDueAt: digestSchedule(input.digestFrequency, Date.now()).next,
        }),
      ...(input.digestPair && { digestPair: input.digestPair }),
      ...(input.rateTips !== undefined || profile.rateTips === true
        ? { rateTips, rateTipPair, rateTipDueAt }
        : {}),
      updatedAt: Date.now(),
    });
  });
  await auth.updateUser(res.locals.uid, { displayName: input.name });
  res.json({ ok: true });
});
app.get('/api/alerts', async (_req, res) => {
  const s = await db.collection('alerts').where('userId', '==', res.locals.uid).get();
  res.json(s.docs.map((d) => d.data()).sort((a, b) => b.createdAt - a.createdAt));
});
app.get('/api/transfer-plans', async (_req, res) => {
  const plans = await db.collection('transferPlans').where('userId', '==', res.locals.uid).get();
  res.json(
    plans.docs
      .sort((a, b) => Number(b.get('updatedAt')) - Number(a.get('updatedAt')))
      .map((plan) => ({ ...plan.data(), id: plan.id })),
  );
});
const savePlan: express.RequestHandler = async (req, res) => {
  const input = transferPlanSchema.parse(req.body);
  const uid = res.locals.uid;
  const profile = db.collection('users').doc(uid);
  const plans = db.collection('transferPlans');
  const id = req.params.id;
  const ref = id ? plans.doc(String(id)) : plans.doc();
  const plan = { ...input, userId: uid, updatedAt: Date.now() };
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(profile)).data()?.deleting)
      throw new HttpError(409, 'Account unavailable');
    if (id && (await transaction.get(ref)).data()?.userId !== uid)
      throw new HttpError(404, 'Transfer plan not found');
    if (input.alertId) {
      const alert = (await transaction.get(db.collection('alerts').doc(input.alertId))).data();
      if (alert?.userId !== uid || alert?.pair !== input.pair)
        throw new HttpError(400, 'Choose one of your alerts for the same currency pair');
    }
    transaction.set(ref, plan);
  });
  res.status(id ? 200 : 201).json({ ...plan, id: ref.id });
};
app.post('/api/transfer-plans', savePlan);
app.put('/api/transfer-plans/:id', savePlan);
app.delete('/api/transfer-plans/:id', async (req, res) => {
  const ref = db.collection('transferPlans').doc(String(req.params.id));
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(ref)).data()?.userId !== res.locals.uid)
      throw new HttpError(404, 'Transfer plan not found');
    transaction.delete(ref);
  });
  res.json({ ok: true });
});
app.post('/api/notifications/clear', async (_req, res) => {
  await db
    .collection('users')
    .doc(res.locals.uid)
    .set({ notificationsClearedAt: Date.now() }, { merge: true });
  res.json({ ok: true });
});
app.delete('/api/notifications/:id', async (req, res) => {
  const ref = db.collection('notificationLogs').doc(String(req.params.id));
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists || snap.data()!.userId !== res.locals.uid)
      throw new HttpError(404, 'Notification not found');
    if (!['sent', 'cancelled'].includes(snap.data()!.status))
      throw new HttpError(409, 'Only completed notifications can be cleared');
    t.update(ref, { dismissed: true });
  });
  res.json({ ok: true });
});
app.get('/api/notifications', async (_req, res) => {
  const profile = await db.collection('users').doc(res.locals.uid).get();
  const clearedAt = profile.data()?.notificationsClearedAt || 0;
  const s = await db
    .collection('notificationLogs')
    .where('userId', '==', res.locals.uid)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  res.json(
    s.docs
      .filter((d) => !d.data().dismissed)
      .filter(
        (d) =>
          !(
            ['sent', 'cancelled'].includes(d.data().status) &&
            (d.data().sentAt || d.data().cancelledAt || d.data().createdAt) <= clearedAt
          ),
      )
      .map((d) => {
        const { payload: _p, leaseToken: _l, ...safe } = d.data();
        return safe;
      }),
  );
});
app.use(
  '/api/alerts',
  rateLimit({ windowMs: 60000, limit: 20, keyGenerator: (_req, res) => res.locals.uid }),
);
async function write(req: express.Request, res: express.Response) {
  const u = await auth.getUser(res.locals.uid);
  if (!u.emailVerified) throw new HttpError(403, 'Verify your email before creating alerts');
  await syncProfile(u);
  const input = alertSchema.parse(req.body);
  if (input.channel !== 'push' && emailProvider() === 'off') {
    throw new HttpError(503, 'Email alerts are unavailable. Choose push notification.');
  }
  if (
    (input.channel === 'push' || input.channel === 'both') &&
    (await pushDevicesFor(u.uid).limit(1).get()).empty
  ) {
    throw new HttpError(
      409,
      'Enable push on at least one device in notification settings before saving a push alert.',
    );
  }
  const rateSource = intradayConfigured() ? 'intraday' : (input.rateSource ?? 'daily');
  const rates = await getAlertRates([input.pair], rateSource),
    rate = rates.find((r) => r.currencyPair === input.pair);
  if (!rate) throw new HttpError(503, 'Rate unavailable');
  const id = await saveAlert(
    u.uid,
    { ...input, rateSource, repeat: false },
    rate,
    typeof req.params.id === 'string' ? req.params.id : undefined,
  );
  if (input.immediate) {
    await enqueue(id, rate);
    const a = await db.collection('alerts').doc(id).get();
    if (a.data()?.status === 'processing') {
      const key = 'alert-' + id + '-' + a.data()!.generation;
      if (input.channel === 'both') await Promise.all([deliver(key), deliver(key + '-push')]);
      else await deliver(key);
    }
  }
  res.status(req.method === 'POST' ? 201 : 200).json({ id });
}
app.post('/api/alerts', write);
app.put('/api/alerts/:id', write);
app.patch('/api/alerts/:id', async (req, res) => {
  const { paused } = z.object({ paused: z.boolean() }).strict().parse(req.body);
  await setAlertPaused(res.locals.uid, String(req.params.id), paused);
  res.json({ ok: true });
});
app.delete('/api/alerts/:id', async (req, res) => {
  await deleteAlert(res.locals.uid, String(req.params.id));
  res.json({ ok: true });
});
app.delete('/api/account', async (_req, res) => {
  const uid = res.locals.uid;
  if (Date.now() / 1000 - res.locals.token.auth_time > 300)
    throw new HttpError(403, 'Sign out and sign in again before deleting your account');
  const u = db.collection('users').doc(uid);
  await db.runTransaction(async (t) => {
    const pending = await t.get(
      db.collection('notificationLogs').where('userId', '==', uid).where('status', '==', 'sending'),
    );
    if (pending.docs.some((d) => d.data().leaseUntil > Date.now()))
      throw new HttpError(409, 'Email processing. Try deletion in two minutes.');
    t.set(u, { deleting: true }, { merge: true });
  });
  for (const collection of ['alerts', 'notificationLogs', 'pushDevices', 'transferPlans'])
    for (;;) {
      const s = await db.collection(collection).where('userId', '==', uid).limit(400).get();
      if (s.empty) break;
      const b = db.batch();
      s.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  await auth.deleteUser(uid);
  await u.delete();
  res.json({ ok: true });
});
app.use('/api', (_req, _res) => {
  throw new HttpError(404, 'Endpoint not found');
});
export function errors(
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid input', details: error.issues.map((i) => i.message) });
    return;
  }
  if (error instanceof Error && /requires an index/i.test(error.message)) {
    log('database_index_missing', { path: _req.path });
    res.status(503).json({
      error:
        'Firestore index setup is incomplete. Create the required database indexes, wait until they are enabled, then retry.',
    });
    return;
  }
  const status = error instanceof HttpError ? error.status : 503;
  if (status === 503)
    log('request_error', { message: error instanceof Error ? error.message : 'Unknown error' });
  res.status(status).json({
    error:
      error instanceof HttpError
        ? error.message
        : 'Service temporarily unavailable. Please try again.',
  });
}
app.use(errors);
