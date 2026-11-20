import { queueDigests } from './digests.js';
import { queueRateTips } from './rate-tips.js';
import { pushDevicesFor, sendPush } from './push.js';
import { intradayConfigured, refreshIntraday } from './intraday.js';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { db, auth } from './firebase.js';
import type { Transaction } from 'firebase-admin/firestore';
import { matches, fresh, type Alert, type Rate } from '../shared/domain.js';
import { template, sendEmail, emailProvider, type EmailPayload } from './email.js';
import { getAlertRates } from './rates.js';
export const log = (event: string, data: object = {}) =>
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }));
export async function enqueue(id: string, rate: Rate, useMarket = false) {
  const aRef = db.collection('alerts').doc(id);
  await db.runTransaction(async (t) => {
    const snap = await t.get(aRef);
    if (!snap.exists) return;
    const a = snap.data() as Alert;
    if (
      a.status !== 'active' ||
      (useMarket ? 'intraday' : a.rateSource || 'daily') !== (rate.kind || 'daily') ||
      a.pair !== rate.currencyPair ||
      !fresh(rate)
    )
      return;
    const marketSource = useMarket && a.rateSource !== 'intraday' ? { rateSource: 'intraday' } : {};
    const reached = matches(rate.rate, a.targetRate, a.condition);
    const observedAt = Date.parse(rate.providerTimestamp);
    if (a.repeat) {
      if (a.lastObservedAt !== undefined && observedAt <= a.lastObservedAt) return;
      if (!reached || a.waitingForReset) {
        t.update(aRef, { ...marketSource, waitingForReset: reached, lastObservedAt: observedAt });
        return;
      }
    }
    if (!reached) {
      if (marketSource.rateSource) t.update(aRef, marketSource);
      return;
    }
    const u = await t.get(db.collection('users').doc(a.userId));
    const channel = a.channel || 'email';
    if (
      !u.exists ||
      u.data()!.deleting ||
      (channel === 'email' &&
        (emailProvider() === 'off' || u.data()!.notificationPreferences?.email === false))
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
      ...marketSource,
      status: 'processing',
      triggeredAt: triggered.triggeredAt,
      triggeredRate: rate.rate,
      observation: rate,
      notificationStatus: 'queued',
      updatedAt: Date.now(),
      ...(a.repeat && { lastObservedAt: observedAt }),
    });
    const channels = channel === 'both' ? ['email', 'push'] : [channel];
    for (const type of channels) {
      const jobId = channel === 'both' && type === 'push' ? key + '-push' : key;
      t.create(db.collection('notificationLogs').doc(jobId), {
        id: jobId,
        userId: a.userId,
        alertId: id,
        generation: a.generation,
        notificationType: type,
        status: 'pending',
        attempts: 0,
        idempotencyKey: jobId,
        createdAt: Date.now(),
        nextAttemptAt: Date.now(),
        leaseUntil: 0,
        payload: type === 'email' ? template(triggered, u.data()!.email) : null,
        ...(channel === 'both' && { siblingId: type === 'email' ? key + '-push' : key }),
      });
    }
  });
}
function deliveryPaused() {
  const environment = process.env.VERCEL_ENV;
  const disabled = process.env.NOTIFICATION_DELIVERY_DISABLED;
  if (environment === 'preview' || disabled === 'true') return true;
  return (environment === 'production' || process.env.VERCEL === '1') && disabled !== 'false';
}
async function finishAlertCycle(
  t: Transaction,
  alertId: string | undefined,
  generation: number | undefined,
  outcome: 'accepted' | 'review_required',
  siblingId?: string,
) {
  if (!alertId) return;
  const ref = db.collection('alerts').doc(alertId);
  const alert = (await t.get(ref)).data();
  if (!alert || alert.generation !== generation || alert.status !== 'processing') return;
  if (siblingId) {
    const sibling = await t.get(db.collection('notificationLogs').doc(siblingId));
    const status = sibling.data()?.status;
    if (status === 'pending' || status === 'sending') return;
    if (status !== 'sent') outcome = 'review_required';
  }
  const recurring = alert.repeat === true;
  if (!recurring && !siblingId && outcome !== 'accepted') return;
  t.update(ref, {
    status: recurring ? 'active' : 'completed',
    ...(recurring && { waitingForReset: true, generation: alert.generation + 1 }),
    notificationStatus: outcome,
    updatedAt: Date.now(),
  });
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
    const provider = j.notificationType === 'push' ? 'push' : emailProvider();
    if (provider === 'off' && !j.siblingId) return;
    const u = await t.get(db.collection('users').doc(j.userId));
    if (
      provider === 'off' ||
      !u.exists ||
      u.data()!.deleting ||
      (j.notificationType === 'digest' &&
        (u.data()!.digestFrequency !== j.frequency ||
          (u.data()!.digestPair || 'NZD/INR') !== j.pair)) ||
      (j.notificationType === 'rate-tip' &&
        (j.expiresAt <= now ||
          u.data()!.rateTips !== true ||
          u.data()!.rateTipPair !== j.pair ||
          u.data()!.notificationPreferences?.email === false)) ||
      (j.notificationType === 'email' && u.data()!.notificationPreferences?.email === false)
    ) {
      const alert = j.alertId ? db.collection('alerts').doc(j.alertId) : null;
      const state = alert ? await t.get(alert) : null;
      const uncertain = j.attempts > 0;
      if (j.siblingId)
        await finishAlertCycle(t, j.alertId, j.generation, 'review_required', j.siblingId);
      else if (!uncertain && alert && state?.data()?.generation === j.generation)
        t.update(alert, { status: 'paused', notificationStatus: 'cancelled', updatedAt: now });
      t.update(ref, {
        status: uncertain ? 'review_required' : 'cancelled',
        cancelledAt: now,
        leaseUntil: 0,
      });
      return;
    }
    const previousProvider = j.deliveryProvider || 'resend';
    if (
      j.attempts > 0 &&
      (previousProvider !== provider || ['gmail', 'push'].includes(previousProvider))
    ) {
      if (provider === 'push' || j.siblingId)
        await finishAlertCycle(t, j.alertId, j.generation, 'review_required', j.siblingId);
      t.update(ref, {
        status: 'review_required',
        leaseUntil: 0,
        errorMessage: 'Delivery requires review before retrying or changing the provider.',
      });
      return;
    }
    if (j.firstAttemptAt && now - j.firstAttemptAt >= 23 * 3600000) {
      if (j.siblingId)
        await finishAlertCycle(t, j.alertId, j.generation, 'review_required', j.siblingId);
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
      const j = await t.get(ref);
      if (j.data()?.leaseToken !== token) return;
      await finishAlertCycle(t, job.alertId, job.generation, 'accepted', job.siblingId);
      t.update(ref, {
        status: 'sent',
        sentAt: Date.now(),
        messageId,
        leaseUntil: 0,
        errorMessage: null,
      });
    });
    log(job.notificationType === 'push' ? 'push_accepted' : 'email_accepted', {
      notificationId: id,
    });
  } catch (error) {
    await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (s.data()?.leaseToken !== token) return;
      if (job.deliveryProvider === 'push' || (job.deliveryProvider === 'gmail' && job.siblingId))
        await finishAlertCycle(t, job.alertId, job.generation, 'review_required', job.siblingId);
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
        const useMarket = intradayConfigured();
        for (const source of useMarket ? ['intraday'] : ['daily', 'intraday']) {
          const selected = useMarket
            ? page.docs
            : page.docs.filter((doc) => (doc.data().rateSource || 'daily') === source);
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
            if (rate) await enqueue(doc.id, rate, useMarket);
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
    const emailEnabled = emailProvider() !== 'off';
    if (emailEnabled) {
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
    }
    let processed = 0;
    if (!deliveryPaused()) {
      const query = db
        .collection('notificationLogs')
        .where('status', 'in', ['pending', 'sending'])
        .where('nextAttemptAt', '<=', Date.now())
        .orderBy('nextAttemptAt')
        .limit(100);
      let jobs = await query.get();
      while (jobs.size) {
        for (const job of jobs.docs) {
          if (!emailEnabled && job.get('notificationType') !== 'push') continue;
          await deliver(job.id);
          processed += 1;
          if (processed === 100) break;
          await pause(600);
        }
        if (processed === 100 || jobs.size < 100) break;
        jobs = await query.startAfter(jobs.docs.at(-1)!).get();
      }
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
