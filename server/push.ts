import { createHash } from 'node:crypto';
import { getMessaging } from 'firebase-admin/messaging';
import { db } from './firebase.js';

const devices = () => db.collection('pushDevices');
export const pushDevicesFor = (uid: string) => devices().where('userId', '==', uid);
const deviceId = (token: string) => createHash('sha256').update(token).digest('hex');

export async function setPushDevice(uid: string, token: string, enabled: boolean) {
  const ref = devices().doc(deviceId(token));
  await db.runTransaction(async (transaction) => {
    const user = await transaction.get(db.collection('users').doc(uid));
    const device = await transaction.get(ref);
    if (!user.exists || user.data()?.deleting) throw new Error('Account unavailable');
    if (enabled) transaction.set(ref, { userId: uid, token, updatedAt: Date.now() });
    else if (device.data()?.userId === uid) transaction.delete(ref);
  });
}

export async function sendPush(uid: string, alertId: string, key: string) {
  const registered = await pushDevicesFor(uid).limit(20).get();
  if (registered.empty) throw new Error('No devices have push enabled');
  const result = await getMessaging().sendEachForMulticast({
    tokens: registered.docs.map((doc) => doc.data().token),
    data: { path: '/dashboard#alert-' + alertId, tag: key },
    webpush: { headers: { TTL: '3600', Urgency: 'high' } },
  });
  await Promise.allSettled(
    result.responses.map(async (response, index) => {
      if (
        response.error?.code !== 'messaging/registration-token-not-registered' &&
        response.error?.code !== 'messaging/invalid-registration-token'
      )
        return;
      const doc = registered.docs[index];
      await db.runTransaction(async (transaction) => {
        if ((await transaction.get(doc.ref)).data()?.updatedAt === doc.data().updatedAt)
          transaction.delete(doc.ref);
      });
    }),
  );
  if (!result.successCount) {
    const code = result.responses.find(({ error }) =>
      /^messaging\/[a-z-]+$/.test(error?.code ?? ''),
    )?.error?.code;
    throw new Error(
      'No registered device accepted the notification' + (code ? ' (' + code + ')' : ''),
    );
  }
  return result.responses.find((entry) => entry.success)!.messageId!;
}
