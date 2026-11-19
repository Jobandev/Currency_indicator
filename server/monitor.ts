import { queueDigests } from './digests.js';
import { queueRateTips } from './rate-tips.js';
import { pushDevicesFor, sendPush } from './push.js';
import { refreshIntraday } from './intraday.js';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { db, auth } from './firebase.js';
import { matches, fresh, type Alert, type Rate } from '../shared/domain.js';
import { template, sendEmail, emailProvider, type EmailPayload } from './email.js';
import { getAlertRates } from './rates.js';
export const log = (event: string, data: object = {}) =>
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }));
export async function enqueue(id: string, rate: Rate) {
  const aRef = db.collection('alerts').doc(id);
  await db.runTransaction(async (t) => {
    const snap = await t.get(aRef);
    if (!snap.exists) return;
    const a = snap.data() as Alert;
    if (
      a.status !== 'active' ||
      (a.rateSource || 'daily') !== (rate.kind || 'daily') ||
      a.pair !== rate.currencyPair ||
      !fresh(rate) ||
      !matches(rate.rate, a.targetRate, a.condition)
    )
      return;
    const u = await t.get(db.collection('users').doc(a.userId));
    const channel = a.channel || 'email';
    if (
      !u.exists ||
      u.data()!.deleting ||
      (channel === 'email' && u.data()!.notificationPreferences?.email === false)
    )
      return;
    if (channel === 'push' && (await t.get(pushDevicesFor(a.userId).limit(1))).empty) return;
    const triggered = {
      ...a,
      triggeredAt: Date.now(),
      triggeredRate: rate.rate,
      observation: rate,
    };
    const key = 'alert-' + id + '-' + a.generation,
      out = db.collection('notificationLogs').doc(key),
      existing = await t.get(out);
    if (existing.exists) return;
    t.update(aRef, {
      status: 'processing',
      triggeredAt: triggered.triggeredAt,
      triggeredRate: rate.rate,
      observation: rate,
      notificationStatus: 'queued',
      updatedAt: Date.now(),
    });
    t.create(out, {
      id: key,
      userId: a.userId,
      alertId: id,
      generation: a.generation,
      notificationType: channel,
      status: 'pending',
      attempts: 0,
      idempotencyKey: key,
      createdAt: Date.now(),
      nextAttemptAt: Date.now(),
      leaseUntil: 0,
      payload: channel === 'email' ? template(triggered, u.data()!.email) : null,
    });
  });
}
function deliveryPaused() {
  const environment = process.env.VERCEL_ENV;
  const disabled = process.env.NOTIFICATION_DELIVERY_DISABLED;
  if (environment === 'preview' || disabled === 'true') return true;
  return (environment === 'production' || process.env.VERCEL === '1') && disabled !== 'false';
}
export async function deliver(id: string, sender = sendEmail, now = Date.now()) {
  if (deliveryPaused()) return;
  const ref = db.collection('notificationLogs').doc(id),
    token = randomUUID();
  const job = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return;
    const j = snap.data()!;
    if (!['pending', 'sending'].includes(j.status) || j.nextAttemptAt > now || j.leaseUntil > now)
      return;
    const u = await t.get(db.collection('users').doc(j.userId));
    if (
      !u.exists ||
      u.data()!.deleting ||
      (j.notificationType === 'digest' &&
        (u.data()!.digestFrequency !== j.frequency ||
          (u.data()!.digestPair || 'NZD/INR') !== j.pair)) ||
      (j.notificationType === 'rate-tip' &&
        (j.expiresAt <= now || u.data()!.rateTips !== true ||
          u.data()!.rateTipPair !== j.pair || u.data()!.notificationPreferences?.email === false)) ||
      (j.notificationType === 'email' && u.data()!.notificationPreferences?.email === false)
    ) {
      const alert = j.alertId ? db.collection('alerts').doc(j.alertId) : null;
      const state = alert ? await t.get(alert) : null;
      const uncertain = j.attempts > 0;
      if (!uncertain && alert && state?.data()?.generation === j.generation)
        t.update(alert, { status: 'paused', notificationStatus: 'cancelled', updatedAt: now });
      t.update(ref, {
        status: uncertain ? 'review_required' : 'cancelled',
        cancelledAt: now,
        leaseUntil: 0,
      });
      return;
    }
    const provider = j.notificationType === 'push' ? 'push' : emailProvider();
    const previousProvider = j.deliveryProvider || 'resend';
    if (
      j.attempts > 0 &&
      (previousProvider !== provider || ['gmail', 'push'].includes(previousProvider))
    ) {
      t.update(ref, {
        status: 'review_required',
        leaseUntil: 0,
        errorMessage: 'Delivery requires review before retrying or changing the provider.',
      });
      return;
    }
    if (
      j.firstAttemptAt &&
      now - j.firstAttemptAt >= (provider === 'brevo' ? 29 * 60000 : 23 * 3600000)
    ) {
      t.update(ref, {
        status: 'review_required',
        errorMessage:
          'Reconcile with the email provider before retrying: idempotency window ending.',
      });
      return;
    }
    t.update(ref, {
      status: 'sending',
      deliveryProvider: provider,
      leaseUntil: now + 120000,
      leaseToken: token,
      attempts: j.attempts + 1,
      firstAttemptAt: j.firstAttemptAt || now,
    });
    return Object.assign(j, { deliveryProvider: provider });
  });
  if (!job) return;
  try {
    const user = await auth.getUser(job.userId);
    if (
      !user.emailVerified ||
      user.disabled ||
      (job.notificationType !== 'push' && user.email !== job.payload.to[0])
    )
      throw new Error('Recipient account requires review');
    const messageId =
      job.notificationType === 'push'
        ? await sendPush(job.userId, job.alertId, job.idempotencyKey)
        : await sender(job.payload as EmailPayload, job.idempotencyKey);
    await db.runTransaction(async (t) => {
      const j = await t.get(ref),
        aRef = job.alertId ? db.collection('alerts').doc(job.alertId) : null,
        a = aRef ? await t.get(aRef) : null;
      if (j.data()?.leaseToken !== token) return;
      t.update(ref, {
        status: 'sent',
        sentAt: Date.now(),
        messageId,
        leaseUntil: 0,
        errorMessage: null,
      });
      if (aRef && a?.exists && a.data()!.generation === job.generation)
        t.update(aRef, {
          status: 'completed',
          notificationStatus: 'accepted',
          updatedAt: Date.now(),
        });
    });
    log(job.notificationType === 'push' ? 'push_accepted' : 'email_accepted', {
      notificationId: id,
    });
  } catch (error) {
    await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (s.data()?.leaseToken === token)
        t.update(ref, {
          status: ['gmail', 'push'].includes(job.deliveryProvider) ? 'review_required' : 'pending',
          leaseUntil: 0,
          nextAttemptAt: now + Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
          errorMessage: error instanceof Error ? error.message : 'Delivery failed',
        });
    });
    log(job.notificationType === 'push' ? 'push_review' : 'email_retry', { notificationId: id });
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
  let completedAt: number | undefined;
  try {
    try {
      await refreshIntraday();
    } catch (error) {
      rateError = true;
      log('intraday_refresh_error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    try {
      let cursor = '';
      for (;;) {
        const query = db.collection('alerts').where('status', '==', 'active').orderBy('__name__');
        const page = await (cursor ? query.startAfter(cursor) : query).limit(200).get();
        for (const source of ['daily', 'intraday']) {
          const selected = page.docs.filter((doc) => (doc.data().rateSource || 'daily') === source);
          if (!selected.length) continue;
          const pairs = selected.map((doc) => doc.data().pair);
          let rates: Rate[];
          try {
            rates =
              source === 'intraday'
                ? await getAlertRates(pairs, source)
                : await getAlertRates(pairs);
          } catch {
            rateError = true;
            log('monitor_rate_source_error', { source });
            continue;
          }
          const map = new Map(rates.map((rate) => [rate.currencyPair, rate]));
          for (const doc of selected) {
            const rate = map.get(doc.data().pair);
            if (rate) await enqueue(doc.id, rate);
          }
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
    try {
      await queueDigests(now);
    } catch {
      rateError = true;
      log('digest_queue_error');
    }
    try {
      await queueRateTips(now);
    } catch {
      rateError = true;
      log('rate_tip_queue_error');
    }
    let processed = 0;
    if (!deliveryPaused()) {
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
      processed = jobs.size;
    }
    completedAt = Date.now();
    return rateError ? { processed, rateError: true } : { processed };
  } finally {
    await db.runTransaction(async (t) => {
      const s = await t.get(lock);
      if (s.data()?.token !== token) return;
      t.update(lock, {
        until: 0,
        ...(completedAt === undefined
          ? {}
          : { lastCompletedAt: completedAt, lastRatesOk: !rateError }),
      });
    });
  }
}
