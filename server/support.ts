import { createHash } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { HttpError } from './alerts.js';
import { adminReady, db } from './firebase.js';

type SupportMessage = { from: 'visitor' | 'support'; text: string; sentAt: number };

const key = z.string().uuid();
const threadId = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.object({ text: z.string().trim().min(1).max(1500) }).strict();
const threads = () => db.collection('supportThreads');

export const supportChat = Router();
export const supportInbox = Router();

supportChat.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!adminReady || !process.env.SUPPORT_INBOX_EMAIL?.trim())
    throw new HttpError(503, 'Support chat is temporarily unavailable.');
  next();
});

function visitorThread(value: unknown) {
  return createHash('sha256').update(key.parse(value)).digest('hex');
}

async function messages(id: string) {
  const ref = threads().doc(id);
  const clearedAt = (await ref.get()).data()?.clearedAt ?? 0;
  const snapshot = await ref
    .collection('messages')
    .where('sentAt', '>', clearedAt)
    .orderBy('sentAt', 'desc')
    .limit(100)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
}

async function send(id: string, from: SupportMessage['from'], message: string) {
  const ref = threads().doc(id);
  const entry = ref.collection('messages').doc();
  const sentAt = await db.runTransaction(async (transaction) => {
    const previous = await transaction.get(ref);
    const state = previous.data();
    if (from === 'support' && !state?.updatedAt)
      throw new HttpError(404, 'Conversation not found.');
    const timestamp = Math.max(
      Date.now(),
      (state?.updatedAt ?? 0) + 1,
      (state?.clearedAt ?? 0) + 1,
    );
    transaction.set(entry, { from, text: message, sentAt: timestamp } satisfies SupportMessage);
    transaction.set(ref, { updatedAt: timestamp, latest: message, from }, { merge: true });
    return timestamp;
  });
  return { id: entry.id, from, text: message, sentAt };
}

supportChat.get('/', async (req, res) => {
  res.json(await messages(visitorThread(req.get('X-Support-Key'))));
});
supportChat.post(
  '/',
  rateLimit({
    windowMs: 60000,
    limit: 8,
    message: { error: 'Too many messages. Please wait a minute.' },
  }),
  async (req, res) => {
    res
      .status(201)
      .json(
        await send(visitorThread(req.get('X-Support-Key')), 'visitor', text.parse(req.body).text),
      );
  },
);

export function canAccessSupportInbox(token?: DecodedIdToken) {
  const owner = process.env.SUPPORT_INBOX_EMAIL?.trim().toLowerCase();
  return Boolean(owner && token?.email_verified === true && token.email?.toLowerCase() === owner);
}

supportInbox.use((_req, res, next) => {
  if (!canAccessSupportInbox(res.locals.token))
    throw new HttpError(403, 'This account does not have access to the support inbox.');
  next();
});

supportInbox.get('/', async (_req, res) => {
  const snapshot = await threads().orderBy('updatedAt', 'desc').limit(100).get();
  res.json(
    snapshot.docs
      .filter((doc) => doc.data().updatedAt)
      .map((doc) => ({ id: doc.id, ...doc.data() })),
  );
});
supportInbox.get('/:id', async (req, res) => {
  res.json(await messages(threadId.parse(req.params.id)));
});
supportInbox.post('/:id', async (req, res) => {
  res
    .status(201)
    .json(await send(threadId.parse(req.params.id), 'support', text.parse(req.body).text));
});

supportInbox.delete('/:id', async (req, res) => {
  const ref = threads().doc(threadId.parse(req.params.id));
  const clearedAt = await db.runTransaction(async (transaction) => {
    const state = (await transaction.get(ref)).data();
    if (!state) return 0;
    if (!state.updatedAt) return state.clearedAt ?? 0;
    const cutoff = Math.max(Date.now(), state.updatedAt);
    transaction.set(ref, { clearedAt: cutoff });
    return cutoff;
  });
  if (clearedAt) {
    const old = ref.collection('messages').where('sentAt', '<=', clearedAt).limit(400);
    for (let snapshot = await old.get(); !snapshot.empty; snapshot = await old.get()) {
      const batch = db.batch();
      for (const doc of snapshot.docs) batch.delete(doc.ref);
      await batch.commit();
    }
  }
  res.json({ ok: true, clearedAt });
});
