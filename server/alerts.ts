import type { Transaction, DocumentSnapshot } from 'firebase-admin/firestore';
import { db } from './firebase.js';
import { matches, fresh, type AlertInput, type Rate } from '../shared/domain.js';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function cancelQueuedNotification(t: Transaction, alert: DocumentSnapshot) {
  if (alert.data()?.status !== 'processing') return;
  const ref = db
    .collection('notificationLogs')
    .doc('alert-' + alert.id + '-' + alert.data()!.generation);
  const refs =
    alert.data()?.channel === 'both'
      ? [ref, db.collection('notificationLogs').doc(ref.id + '-push')]
      : [ref];
  const jobs = await Promise.all(refs.map((job) => t.get(job)));
  if (jobs.some((job) => !job.exists || job.data()!.status !== 'pending'))
    throw new HttpError(
      409,
      'Notification delivery is in progress or requires review. Try again shortly.',
    );
  for (const job of refs)
    t.update(job, {
      status: 'cancelled',
      leaseUntil: 0,
      cancelledAt: Date.now(),
      errorMessage: 'Cancelled when alert was edited or deleted',
    });
}
export async function saveAlert(uid: string, input: AlertInput, rate: Rate, id?: string) {
  if (
    rate.currencyPair !== input.pair ||
    (input.rateSource || 'daily') !== (rate.kind || 'daily') ||
    !fresh(rate)
  )
    throw new HttpError(503, 'Fresh reference rates temporarily unavailable');
  const reached = matches(rate.rate, input.targetRate, input.condition);
  if (reached && !input.immediate && !input.repeat)
    throw new HttpError(
      409,
      'Target already satisfied. Enable immediate notification to continue.',
    );
  const userRef = db.collection('users').doc(uid),
    ref = id ? db.collection('alerts').doc(id) : db.collection('alerts').doc();
  await db.runTransaction(async (t) => {
    const user = await t.get(userRef),
      old = await t.get(ref);
    const active = await t.get(
      db
        .collection('alerts')
        .where('userId', '==', uid)
        .where('status', 'in', ['active', 'processing']),
    );
    if (!user.exists || user.data()!.deleting) throw new HttpError(409, 'Account unavailable');
    if (id && (!old.exists || old.data()!.userId !== uid))
      throw new HttpError(404, 'Alert not found');
    if (active.docs.filter((d) => d.id !== ref.id).length >= 3)
      throw new HttpError(409, 'The free plan includes three active alerts');
    await cancelQueuedNotification(t, old);
    const [baseCurrency, quoteCurrency] = input.pair.split('/');
    const now = Date.now();
    t.update(userRef, { updatedAt: now });
    t.set(ref, {
      ...input,
      id: ref.id,
      userId: uid,
      baseCurrency,
      quoteCurrency,
      status: old.data()?.status === 'paused' ? 'paused' : 'active',
      generation: (old.data()?.generation || 0) + 1,
      createdAt: old.data()?.createdAt || now,
      updatedAt: now,
      ...(input.repeat && {
        waitingForReset: reached && !input.immediate,
        ...(input.immediate && reached
          ? {}
          : { lastObservedAt: Date.parse(rate.providerTimestamp) }),
      }),
    });
  });
  return ref.id;
}
export async function deleteAlert(uid: string, id: string) {
  const ref = db.collection('alerts').doc(id),
    u = db.collection('users').doc(uid);
  await db.runTransaction(async (t) => {
    const a = await t.get(ref);
    if (!a.exists || a.data()!.userId !== uid) throw new HttpError(404, 'Alert not found');
    await cancelQueuedNotification(t, a);
    t.update(u, { updatedAt: Date.now() });
    t.delete(ref);
  });
}

export async function setAlertPaused(uid: string, id: string, paused: boolean) {
  const ref = db.collection('alerts').doc(id);
  const user = db.collection('users').doc(uid);
  await db.runTransaction(async (t) => {
    const account = await t.get(user);
    const alert = (await t.get(ref)).data();
    if (!alert || alert.userId !== uid) throw new HttpError(404, 'Alert not found');
    if (!account.exists || account.data()?.deleting)
      throw new HttpError(409, 'Account unavailable');
    if (!['active', 'paused'].includes(alert.status))
      throw new HttpError(409, 'Only active or paused alerts can be changed here');
    const status = paused ? 'paused' : 'active';
    if (alert.status === status) return;
    if (!paused) {
      const active = await t.get(
        db
          .collection('alerts')
          .where('userId', '==', uid)
          .where('status', 'in', ['active', 'processing']),
      );
      if (active.docs.length >= 3)
        throw new HttpError(409, 'The free plan includes three active alerts');
    }
    const now = Date.now();
    t.update(user, { updatedAt: now });
    t.update(ref, {
      status,
      updatedAt: now,
      generation: paused ? alert.generation : alert.generation + 1,
    });
  });
}
