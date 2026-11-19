import { db } from './firebase.js';
import { history } from './rates.js';
import type { EmailPayload } from './email.js';
import { PAIRS } from '../shared/domain.js';

const day = 86400000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
type Point = { date: string; rate: number };

export function findRateExtreme(rows: Point[], now: number) {
  const today = iso(now);
  const recent = [
    ...new Map(
      rows
        .filter(({ date, rate }) => date <= today && Number.isFinite(rate) && rate > 0)
        .map((row) => [row.date, row]),
    ).values(),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const latest = recent.pop();
  if (!latest || !latest.date.startsWith(today.slice(0, 7))) return null;
  const published = Date.parse(latest.date);
  if (!Number.isFinite(published) || iso(published) !== latest.date || now - published >= 3 * day)
    return null;
  const previous = recent.filter((row) => row.date >= iso(published - 30 * day));
  if (previous.length < 15) return null;
  const rate = latest.rate;
  if (previous.every((row) => rate > row.rate)) return { direction: 'high', ...latest } as const;
  if (previous.every((row) => rate < row.rate)) return { direction: 'low', ...latest } as const;
  return null;
}

export async function queueRateTips(now: number) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return;
  const due = await db
    .collection('users')
    .where('rateTipDueAt', '>=', 1)
    .where('rateTipDueAt', '<=', now)
    .orderBy('rateTipDueAt')
    .limit(25)
    .get();
  const reports = new Map<string, Promise<ReturnType<typeof findRateExtreme>>>();
  const currentDate = new Date(now);
  const today = iso(now);
  const nextMonth = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1);
  const nextDay = Date.parse(iso(now)) + day;
  const accounts = due.docs.map((account) => {
    const user = account.data();
    const pair = PAIRS.find((value) => value === user.rateTipPair);
    const eligiblePair =
      user.rateTips === true &&
      user.emailVerified &&
      user.email &&
      !user.deleting &&
      user.notificationPreferences?.email !== false
        ? pair
        : undefined;
    if (eligiblePair && !reports.has(eligiblePair)) {
      reports.set(
        eligiblePair,
        history(eligiblePair, iso(now - 33 * day), today)
          .then((rows) => findRateExtreme(rows, now))
          .catch(() => null),
      );
    }
    return { account, user, pair: eligiblePair };
  });
  for (const { account, user, pair } of accounts) {
    if (!pair) {
      await db.runTransaction(async (transaction) => {
        const current = (await transaction.get(account.ref)).data();
        if (current?.rateTipDueAt === user.rateTipDueAt) {
          transaction.update(account.ref, { rateTipDueAt: nextDay });
        }
      });
      continue;
    }

    const extreme = await reports.get(pair)!;
    const key = 'rate-tip-' + account.id + '-' + today.slice(0, 7);
    const ref = db.collection('notificationLogs').doc(key);
    let payload: EmailPayload | undefined;
    if (extreme) {
      const alert = new URL('/alerts/new', appUrl);
      alert.searchParams.set('pair', pair);
      const settings = new URL('/settings', appUrl);
      const subject = pair + ' reached a new 30-day ' + extreme.direction;
      const [base, quote] = pair.split('/');
      const summary =
        'On ' +
        extreme.date +
        ', 1 ' +
        base +
        ' was worth ' +
        extreme.rate +
        ' ' +
        quote +
        '. This is a new ' +
        extreme.direction +
        ' compared with the preceding 30 days of Frankfurter reference rates.';
      payload = {
        from: process.env.EMAIL_FROM || '',
        to: [user.email],
        subject,
        text: [
          subject,
          summary,
          'Create a target alert: ' + alert.href,
          'Manage rate-tip emails: ' + settings.href,
        ].join('\n\n'),
        html:
          '<main><h1>' +
          subject +
          '</h1><p>' +
          summary +
          '</p><p><a href="' +
          alert.href +
          '">Create a target alert</a></p><p><a href="' +
          settings.href +
          '">Manage rate-tip emails</a></p></main>',
      };
    }
    await db.runTransaction(async (transaction) => {
      const current = (await transaction.get(account.ref)).data();
      const existing = await transaction.get(ref);
      if (
        !current ||
        current.deleting ||
        !current.emailVerified ||
        current.email !== user.email ||
        current.notificationPreferences?.email === false ||
        current.rateTips !== true ||
        current.rateTipPair !== pair ||
        current.rateTipDueAt !== user.rateTipDueAt
      )
        return;
      transaction.update(account.ref, {
        rateTipDueAt: payload || existing.exists ? nextMonth : nextDay,
      });
      if (payload && extreme && !existing.exists)
        transaction.create(ref, {
          id: key,
          userId: account.id,
          notificationType: 'rate-tip',
          pair,
          payload,
          status: 'pending',
          attempts: 0,
          createdAt: now,
          nextAttemptAt: now,
          leaseUntil: 0,
          idempotencyKey: key,
          expiresAt: Math.min(nextMonth, Date.parse(extreme.date) + 3 * day),
        });
    });
  }
}
