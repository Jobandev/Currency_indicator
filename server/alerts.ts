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
  const job = await t.get(ref);
  if (!job.exists || job.data()!.status !== 'pending')
    throw new HttpError(
      409,
      'Email delivery is in progress or requires review. Try again shortly.',
    );
  t.update(ref, {
    status: 'cancelled',
    leaseUntil: 0,
    cancelledAt: Date.now(),
    errorMessage: 'Cancelled when alert was edited or deleted',
  });
}
export async function saveAlert(uid: string, input: AlertInput, rate: Rate, id?: string) {
  if (!fresh(rate)) throw new HttpError(503, 'Fresh reference rates temporarily unavailable');
  if (matches(rate.rate, input.targetRate, input.condition) && !input.immediate)
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
      status: 'active',
      generation: (old.data()?.generation || 0) + 1,
      createdAt: old.data()?.createdAt || now,
      updatedAt: now,
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
