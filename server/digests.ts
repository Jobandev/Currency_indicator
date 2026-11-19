import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './firebase.js';
import { history } from './rates.js';
import type { EmailPayload } from './email.js';
import { pairSchema } from '../shared/domain.js';

const day = 86400000;
const date = (time: number) => new Date(time).toISOString().slice(0, 10);
const defaultPair = 'NZD/INR';

export function digestSchedule(frequency: 'weekly' | 'monthly', now: number) {
  const current = new Date(now);
  const month = current.getUTCMonth();
  const year = current.getUTCFullYear();
  if (frequency === 'monthly')
    return {
      start: date(Date.UTC(year, month - 1, 1)),
      end: date(Date.UTC(year, month, 1) - day),
      next: Date.UTC(year, month + 1, 1),
    };
  const monday = Date.parse(date(now)) - ((current.getUTCDay() + 6) % 7) * day;
  return { start: date(monday - 7 * day), end: date(monday - day), next: monday + 7 * day };
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export async function unsubscribeDigest(value: string, signature: string) {
  const secret = process.env.DIGEST_SECRET;
  if (!secret || secret.length < 32) return false;
  const expected = sign(value, secret);
  if (
    !/^[\w-]{43}$/.test(signature) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  )
    return false;
  const uid = Buffer.from(value, 'base64url').toString('utf8');
  if (!uid || uid.includes('/') || uid.length > 128) return false;
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async (t) => {
    if ((await t.get(ref)).exists) t.update(ref, { digestFrequency: 'off', digestDueAt: null });
  });
  return true;
}

export async function queueDigests(now: number) {
  const secret = process.env.DIGEST_SECRET;
  if (!secret || secret.length < 32 || !process.env.APP_URL) return;
  const due = await db
    .collection('users')
    .where('digestDueAt', '<=', now)
    .orderBy('digestDueAt')
    .limit(50)
    .get();
  const reports = new Map<string, ReturnType<typeof history>>();
  for (const account of due.docs) {
    const user = account.data();
    if (
      !['weekly', 'monthly'].includes(user.digestFrequency) ||
      !user.emailVerified ||
      user.deleting ||
      !user.email
    )
      continue;
    const frequency = user.digestFrequency as 'weekly' | 'monthly';
    const pair = pairSchema.safeParse(user.digestPair || defaultPair);
    if (!pair.success) continue;
    const period = digestSchedule(frequency, now);
    const reportKey = [pair.data, period.start, period.end].join(':');
    if (!reports.has(reportKey))
      reports.set(reportKey, history(pair.data, period.start, period.end));
    const rows = await reports.get(reportKey)!.catch(() => null);
    if (!rows) {
      console.log(JSON.stringify({ event: 'digest_history_unavailable', pair: pair.data }));
      continue;
    }
    const key = ['digest', account.id, frequency, period.end].join('-');
    const ref = db.collection('notificationLogs').doc(key);
    const subject = 'RateWatch ' + frequency + ' summary: ' + pair.data;
    const rates = rows.map((row: { rate: number }) => row.rate);
    const summary = rates.length
      ? 'Across ' +
        rates.length +
        ' daily observations, the rate ranged from ' +
        Math.min(...rates).toFixed(4) +
        ' to ' +
        Math.max(...rates).toFixed(4) +
        '.'
      : 'No daily observations were available for this period.';
    const value = Buffer.from(account.id).toString('base64url');
    const unsubscribe = new URL('/unsubscribe', process.env.APP_URL);
    unsubscribe.hash = value + '.' + sign(value, secret);
    const payload: EmailPayload = {
      from: process.env.EMAIL_FROM || '',
      to: [user.email],
      subject,
      text: [
        subject,
        period.start + ' to ' + period.end + ' UTC',
        summary,
        'Source: https://frankfurter.dev/',
        'Unsubscribe: ' + unsubscribe.href,
      ].join('\n\n'),
      html:
        '<main><h1>' +
        subject +
        '</h1><p>' +
        period.start +
        ' to ' +
        period.end +
        ' UTC</p><p>' +
        summary +
        '</p><p>Source: <a href="https://frankfurter.dev/">Frankfurter daily reference rates</a>.</p><p><a href="' +
        unsubscribe.href +
        '">Unsubscribe from summaries</a></p></main>',
    };
    await db.runTransaction(async (t) => {
      const latest = (await t.get(account.ref)).data();
      const existing = await t.get(ref);
      if (
        !latest ||
        latest.deleting ||
        latest.digestFrequency !== frequency ||
        latest.digestPair !== user.digestPair ||
        latest.digestDueAt !== user.digestDueAt
      )
        return;
      t.update(account.ref, { digestDueAt: period.next });
      if (!existing.exists)
        t.create(ref, {
          id: key,
          userId: account.id,
          notificationType: 'digest',
          frequency,
          pair: pair.data,
          payload,
          idempotencyKey: key,
          status: 'pending',
          attempts: 0,
          createdAt: now,
          nextAttemptAt: now,
          leaseUntil: 0,
        });
    });
  }
}
