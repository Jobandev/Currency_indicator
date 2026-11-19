import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Alert } from '../shared/domain.js';
export type EmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};
export function emailProvider(): 'gmail' | 'resend' | 'brevo' {
  const provider = process.env.EMAIL_PROVIDER || 'brevo';
  if (provider !== 'gmail' && provider !== 'resend' && provider !== 'brevo')
    throw new Error('Unsupported email provider');
  return provider;
}
function senderAddress() {
  if (emailProvider() === 'gmail') {
    const user = process.env.GMAIL_USER?.trim();
    if (!user || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(user))
      throw new Error('Configure GMAIL_USER with your Gmail sender address');
    return 'RateWatch <' + user + '>';
  }
  return process.env.EMAIL_FROM || '';
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
export function template(a: Alert, to: string): EmailPayload {
  const detected =
    new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(a.triggeredAt!)) + ' UTC';
  const [base, quote] = a.pair.split('/');
  const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 6 });
  const target =
    (a.condition === 'gte' ? 'At or above ' : 'At or below ') + number(a.targetRate) + ' ' + quote;
  const rate = '1 ' + base + ' = ' + number(a.triggeredRate!) + ' ' + quote;
  const url = new URL('/dashboard', process.env.APP_URL || 'http://localhost:5173').href;
  const settings = new URL('/settings', url).href;
  const source =
    a.observation?.kind === 'intraday'
      ? 'Rates by Exchangerate.dev (https://exchangerate.dev/), delayed observation at ' +
        a.observation.providerTimestamp
      : 'Frankfurter daily reference rates';
  const sourceHtml = escapeHtml(source).replace(
    'Rates by Exchangerate.dev (https://exchangerate.dev/)',
    '<a href="https://exchangerate.dev/">Rates by Exchangerate.dev</a>',
  );
  const subject = 'RateWatch alert: ' + a.pair + ' target reached';
  const text = [
    'RateWatch | Currency alert',
    '',
    'Your ' + a.pair + ' target was reached.',
    '',
    'Your target: ' + target,
    'Observed rate: ' + rate,
    'Detected at: ' + detected,
    '',
    'View your alert: ' + url,
    '',
    'You received this one-time email because you created a currency alert in RateWatch.',
    'Manage email preferences: ' + settings,
    '',
    'Source: ' +
      source +
      '. The detection time is when RateWatch checked the rate, not the market quote time. This is not a live trading price. Bank and transfer-provider rates and fees may differ.',
  ].join('\n');
  const detailRow = (label: string, value: string) =>
    '<tr><td style="padding:14px 16px;border-bottom:1px solid #e7ece9;color:#5c6c64;font-size:14px">' +
    label +
    '</td><td style="padding:14px 16px;border-bottom:1px solid #e7ece9;font-size:15px;font-weight:600;text-align:right">' +
    escapeHtml(value) +
    '</td></tr>';
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escapeHtml(subject) +
    '</title></head>' +
    '<body style="margin:0;padding:0;background:#f3f6f4;color:#18382b;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="display:none;max-height:0;overflow:hidden">' +
    escapeHtml(rate + '. Your requested target has been reached.') +
    '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">' +
    '<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e0e8e3;border-radius:16px">' +
    '<tr><td style="padding:24px 28px;border-bottom:1px solid #e7ece9;font-size:24px;font-weight:700">RateWatch <span style="font-size:12px;font-weight:400;color:#61746a">CURRENCY ALERT</span></td></tr>' +
    '<tr><td style="padding:28px"><p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#35734f">TARGET REACHED</p>' +
    '<h1 style="margin:0 0 12px;font-size:26px;line-height:1.3">Your ' +
    escapeHtml(a.pair) +
    ' alert is ready.</h1>' +
    '<p style="margin:0 0 24px;color:#5c6c64;font-size:15px;line-height:1.6">The monitored rate met the target you set. Here are the details of your alert.</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f8f6;border:1px solid #e7ece9;border-radius:8px">' +
    detailRow('Currency pair', a.pair) +
    detailRow('Your target', target) +
    detailRow('Detected rate', rate) +
    detailRow('Detected at', detected) +
    '</table>' +
    '<p style="margin:28px 0"><a href="' +
    escapeHtml(url) +
    '" style="display:inline-block;background:#183e2d;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-size:14px;font-weight:700">View your alert</a></p>' +
    '<p style="margin:0;font-size:12px;color:#6c7c72;line-height:1.6">Source: ' +
    sourceHtml +
    '. The detection time is when RateWatch checked the rate, not the market quote time. This is not a live trading price. Bank and transfer-provider rates and fees may differ.</p></td></tr>' +
    '<tr><td style="padding:20px 28px;border-top:1px solid #e7ece9;font-size:12px;line-height:1.7;color:#6c7c72">You received this one-time email because you created a currency alert in RateWatch.<br>' +
    '<a href="' +
    escapeHtml(settings) +
    '" style="color:#285c40">Manage email preferences</a> &middot; <a href="' +
    escapeHtml(url) +
    '" style="color:#285c40">Open RateWatch</a></td></tr></table></td></tr></table></body></html>';
  return { from: senderAddress(), to: [to], subject, text, html };
}
export async function sendEmail(payload: EmailPayload, key: string): Promise<string> {
  if (emailProvider() === 'gmail') {
    const from = senderAddress();
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
    if (!pass) throw new Error('Gmail App Password is not configured');
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER!.trim(), pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail({
        ...payload,
        from,
        messageId: '<' + createHash('sha256').update(key).digest('hex') + '@gmail.com>',
      });
      if (!result.accepted?.length || result.rejected?.length)
        throw new Error('Gmail did not accept the recipient');
      return result.messageId;
    } catch {
      // Do not expose authentication details or SMTP responses to the client.
      throw new Error(
        'Gmail delivery needs review. Check sender authentication, sending limits and Sent mail before retrying.',
      );
    } finally {
      transport.close();
    }
  }
  if (emailProvider() === 'brevo') return sendBrevo(payload, key);
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

async function sendBrevo(payload: EmailPayload, key: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const email = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !email) throw new Error('Brevo is not configured');
  const hash = createHash('sha256')
    .update('ratewatch:brevo:' + key)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x40;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  const uuid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email, name: 'RateWatch' },
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
      headers: { idempotencyKey: uuid },
      messageVersions: [{ to: payload.to.map((address) => ({ email: address })) }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = (await response.json().catch(() => ({}))) as {
    code?: string;
    messageId?: string;
    messageIds?: string[];
  };
  if (!response.ok) {
    if (response.status === 400 && result.code === 'duplicate_parameter')
      return 'brevo-deduplicated:' + key;
    throw new Error('Brevo returned ' + response.status);
  }
  const messageId = result.messageId || result.messageIds?.[0];
  if (!messageId) throw new Error('Brevo omitted the message ID');
  return messageId;
}
