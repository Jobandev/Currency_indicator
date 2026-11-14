import type { Alert } from '../shared/domain.js';
export type EmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};
export function template(a: Alert, to: string): EmailPayload {
  const detected = new Date(a.triggeredAt!).toISOString();
  const detail =
    a.pair +
    ': target ' +
    (a.condition === 'gte' ? '>=' : '<=') +
    ' ' +
    a.targetRate +
    '; detected ' +
    a.triggeredRate +
    ' at ' +
    detected +
    '.';
  const url = new URL('/dashboard', process.env.APP_URL || 'http://localhost:5173').href;
  return {
    from: process.env.EMAIL_FROM || '',
    to: [to],
    subject: 'Your ' + a.pair + ' target rate has been reached!',
    text:
      'RateWatch. ' +
      detail +
      ' Manage alerts: ' +
      url +
      '. Reference rates may differ from transfer-provider rates and fees.',
    html:
      '<!doctype html><html><body style="margin:0;background:#f2f5f3;font-family:Arial,sans-serif;color:#172e29"><main style="max-width:560px;margin:32px auto;padding:32px;background:white;border-radius:16px"><h2>&#8599; RateWatch</h2><p>YOUR MOMENT HAS ARRIVED</p><h1>Your target rate was reached.</h1><p>' +
      detail +
      '</p><p>These are daily reference rates, not executable quotes.</p><a style="display:inline-block;padding:14px 22px;background:#173e33;color:white;border-radius:8px" href="' +
      url +
      '">Manage your alerts</a><hr><p style="font-size:12px">Rates may change. Banks and money-transfer providers may offer different rates or charge fees. You requested this one-time notification. Manage preferences in your dashboard.</p></main></body></html>',
  };
}
export async function sendEmail(payload: EmailPayload, key: string): Promise<string> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error('Email service is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Email provider returned ' + response.status);
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error('Email provider omitted message ID');
  return result.id;
}
