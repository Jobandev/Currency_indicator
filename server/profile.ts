import type { UserRecord } from 'firebase-admin/auth';
import { db } from './firebase.js';
import { HttpError } from './alerts.js';
// Only authoritative Firebase Auth fields enter the profile; client IDs/plans are never accepted.
export async function syncProfile(user: UserRecord) {
  const ref = db.collection('users').doc(user.uid);
  await db.runTransaction(async (transaction) => {
    const profile = await transaction.get(ref);
    if (profile.data()?.deleting) throw new HttpError(409, 'Account deletion in progress');
    const fields = {
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      emailVerified: user.emailVerified,
      updatedAt: Date.now(),
    };
    transaction.set(
      ref,
      profile.exists
        ? fields
        : {
            ...fields,
            createdAt: Date.now(),
            plan: 'free',
            notificationPreferences: { email: true },
          },
      { merge: true },
    );
  });
}
