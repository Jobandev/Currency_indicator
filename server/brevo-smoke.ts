import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sendEmail, template } from './email.js';

const [flag, runId, ...extra] = process.argv.slice(2);
const recipient = z.email().safeParse(process.env.BREVO_SMOKE_RECIPIENT);
if (
  flag !== '--send-one' ||
  !runId ||
  !/^[a-zA-Z0-9_-]{8,64}$/.test(runId) ||
  extra.length ||
  !recipient.success ||
  process.env.EMAIL_PROVIDER !== 'brevo' ||
  !process.env.BREVO_API_KEY ||
  !z.email().safeParse(process.env.BREVO_SENDER_EMAIL).success
) {
  console.error(
    'No email sent. Set the approved recipient and Brevo configuration, then supply --send-one and a unique test ID.',
  );
  process.exitCode = 1;
} else {
  const now = Date.now();
  const payload = template(
    {
      id: 'preview-smoke',
      userId: '',
      pair: 'NZD/INR',
      baseCurrency: 'NZD',
      quoteCurrency: 'INR',
      targetRate: 50,
      triggeredRate: 50,
      triggeredAt: now,
      condition: 'gte',
      immediate: true,
      status: 'completed',
      generation: 1,
      createdAt: now,
      updatedAt: now,
    },
    recipient.data,
  );
  const notice = 'Test email using sample data. No rate alert was triggered.';
  const key =
    'brevo-smoke-' +
    createHash('sha256')
      .update(recipient.data + ':' + runId)
      .digest('hex');
  try {
    const id = await sendEmail(
      {
        ...payload,
        subject: '[RateWatch preview] Email delivery test',
        text: notice + '\n\n' + payload.text,
        html: payload.html.replace(/(<body[^>]*>)/, '$1<p>' + notice + '</p>'),
      },
      key,
    );
    console.log('Brevo accepted the preview test or recognized its existing idempotency key:', id);
  } catch {
    console.error('Brevo acceptance could not be confirmed. Check provider logs before any retry.');
    process.exitCode = 1;
  }
}
