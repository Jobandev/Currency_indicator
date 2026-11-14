import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { db, auth } from './firebase.js';
import { matches, fresh, type Alert, type Rate } from '../shared/domain.js';
import { template, sendEmail, type EmailPayload } from './email.js';
import { getAlertRates } from './rates.js';
export const log = (event: string, data: object = {}) =>
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }));
export async function enqueue(id: string, rate: Rate) {
  const aRef = db.collection('alerts').doc(id);
  await db.runTransaction(async (t) => {
    const snap = await t.get(aRef);
    if (!snap.exists) return;
    const a = snap.data() as Alert;
    if (a.status !== 'active' || !fresh(rate) || !matches(rate.rate, a.targetRate, a.condition))
      return;
    const u = await t.get(db.collection('users').doc(a.userId));
    if (!u.exists || u.data()!.deleting || u.data()!.notificationPreferences?.email === false)
      return;
    const triggered = { ...a, triggeredAt: Date.now(), triggeredRate: rate.rate };
    const key = 'alert-' + id + '-' + a.generation,
      out = db.collection('notificationLogs').doc(key),
      existing = await t.get(out);
    if (existing.exists) return;
    t.update(aRef, {
      status: 'processing',
      triggeredAt: triggered.triggeredAt,
      triggeredRate: rate.rate,
      notificationStatus: 'queued',
      updatedAt: Date.now(),
    });
    t.create(out, {
      id: key,
      userId: a.userId,
      alertId: id,
      generation: a.generation,
      notificationType: 'email',
      status: 'pending',
      attempts: 0,
      idempotencyKey: key,
      createdAt: Date.now(),
      nextAttemptAt: Date.now(),
      leaseUntil: 0,
      payload: template(triggered, u.data()!.email),
    });
  });
}
export async function deliver(id: string, sender = sendEmail, now = Date.now()) {
  const ref = db.collection('notificationLogs').doc(id),
    token = randomUUID();
  const job = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return;
    const j = snap.data()!;
    if (!['pending', 'sending'].includes(j.status) || j.nextAttemptAt > now || j.leaseUntil > now)
      return;
    const u = await t.get(db.collection('users').doc(j.userId));
    if (!u.exists || u.data()!.deleting) {
      t.update(ref, { status: 'cancelled' });
      return;
    }
    if (j.firstAttemptAt && now - j.firstAttemptAt >= 23 * 3600000) {
      t.update(ref, {
        status: 'review_required',
        errorMessage: 'Reconcile with Resend before retrying: idempotency window ending.',
      });
      return;
    }
    t.update(ref, {
      status: 'sending',
      leaseUntil: now + 120000,
      leaseToken: token,
      attempts: j.attempts + 1,
      firstAttemptAt: j.firstAttemptAt || now,
    });
    return j;
  });
  if (!job) return;
  try {
    const user = await auth.getUser(job.userId);
    if (!user.emailVerified || user.disabled || user.email !== job.payload.to[0])
      throw new Error('Recipient account requires review');
    const messageId = await sender(job.payload as EmailPayload, job.idempotencyKey);
    await db.runTransaction(async (t) => {
      const j = await t.get(ref),
        aRef = db.collection('alerts').doc(job.alertId),
        a = await t.get(aRef);
      if (j.data()?.leaseToken !== token) return;
      t.update(ref, {
        status: 'sent',
        sentAt: Date.now(),
        messageId,
        leaseUntil: 0,
        errorMessage: null,
      });
      if (a.exists && a.data()!.generation === job.generation)
        t.update(aRef, {
          status: 'completed',
          notificationStatus: 'accepted',
          updatedAt: Date.now(),
        });
    });
    log('email_accepted', { notificationId: id });
  } catch (error) {
    await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (s.data()?.leaseToken === token)
        t.update(ref, {
          status: 'pending',
          leaseUntil: 0,
          nextAttemptAt: now + Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
          errorMessage: error instanceof Error ? error.message : 'Delivery failed',
        });
    });
    log('email_retry', { notificationId: id });
  }
}
export async function monitor() {
  const lock = db.collection('system').doc('monitor'),
    token = randomUUID(),
    now = Date.now();
  const claimed = await db.runTransaction(async (t) => {
    const s = await t.get(lock);
    if (s.data()?.until > now) return false;
    t.set(lock, { token, until: now + 10 * 60000 }, { merge: true });
    return true;
  });
  if (!claimed) return { busy: true };
  let rateError = false;
  try {
    try {
      let cursor = '';
      for (;;) {
        const page = await db
          .collection('alerts')
          .where('status', '==', 'active')
          .orderBy('__name__')
          .startAfter(cursor)
          .limit(200)
          .get();
        const rates = await getAlertRates(page.docs.map((doc) => doc.data().pair));
        const map = new Map(rates.map((rate) => [rate.currencyPair, rate]));
        for (const doc of page.docs) {
          const r = map.get(doc.data().pair);
          if (r) await enqueue(doc.id, r);
        }
        if (page.size < 200) break;
        cursor = page.docs.at(-1)!.id;
      }
    } catch (error) {
      rateError = true;
      log('monitor_rates_error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    const jobs = await db
      .collection('notificationLogs')
      .where('status', 'in', ['pending', 'sending'])
      .where('nextAttemptAt', '<=', Date.now())
      .orderBy('nextAttemptAt')
      .limit(100)
      .get();
    for (const j of jobs.docs) {
      await deliver(j.id);
      await pause(600);
    }
    await lock.set({ lastCompletedAt: Date.now(), lastRatesOk: !rateError }, { merge: true });
    return rateError ? { processed: jobs.size, rateError: true } : { processed: jobs.size };
  } finally {
    await db.runTransaction(async (t) => {
      const s = await t.get(lock);
      if (s.data()?.token === token) t.update(lock, { until: 0 });
    });
  }
}
