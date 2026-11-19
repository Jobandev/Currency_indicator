import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));
import { sendEmail } from '../server/email';
const payload = {
  from: 'RateWatch <onboarding@resend.dev>',
  to: ['friend@example.test'],
  subject: 'Target reached',
  text: 'Test',
  html: '<p>Test</p>',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('EMAIL_PROVIDER', 'gmail');
  vi.stubEnv('GMAIL_USER', 'ratewatch510@gmail.com');
  vi.stubEnv('GMAIL_APP_PASSWORD', 'test app password');
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail, close: mocks.close });
});
afterEach(() => vi.unstubAllEnvs());
it('uses authenticated Gmail sender, TLS and a stable message ID', async () => {
  mocks.sendMail.mockResolvedValue({
    accepted: ['friend@example.test'],
    rejected: [],
    messageId: 'message-1',
  });
  expect(await sendEmail(payload, 'alert-1')).toBe('message-1');
  await sendEmail(payload, 'alert-1');
  expect(mocks.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'ratewatch510@gmail.com', pass: 'testapppassword' },
    }),
  );
  expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({
    from: 'RateWatch <ratewatch510@gmail.com>',
    to: payload.to,
  });
  expect(mocks.sendMail.mock.calls[0][0].messageId).toBe(mocks.sendMail.mock.calls[1][0].messageId);
  expect(mocks.close).toHaveBeenCalledTimes(2);
});
it('rejects missing credentials before connecting', async () => {
  vi.stubEnv('GMAIL_APP_PASSWORD', '');
  await expect(sendEmail(payload, 'alert-1')).rejects.toThrow('App Password');
  expect(mocks.createTransport).not.toHaveBeenCalled();
});
it('hides raw SMTP authentication errors and closes the transport', async () => {
  mocks.sendMail.mockRejectedValue(new Error('sensitive SMTP response'));
  await expect(sendEmail(payload, 'alert-1')).rejects.toThrow('Gmail delivery needs review');
  expect(mocks.close).toHaveBeenCalledOnce();
});
it('does not report acceptance when Gmail rejects the recipient', async () => {
  mocks.sendMail.mockResolvedValue({ accepted: [], rejected: payload.to, messageId: 'message-1' });
  await expect(sendEmail(payload, 'alert-1')).rejects.toThrow('Gmail delivery needs review');
});
it('rejects an unknown provider instead of silently using another sender', async () => {
  vi.stubEnv('EMAIL_PROVIDER', 'unknown');
  await expect(sendEmail(payload, 'alert-1')).rejects.toThrow('Unsupported email provider');
});

it('rejects sends when no email provider is selected', async () => {
  vi.stubEnv('EMAIL_PROVIDER', undefined);
  await expect(sendEmail(payload, 'alert-1')).rejects.toThrow(
    'Email notification delivery is disabled',
  );
  expect(mocks.createTransport).not.toHaveBeenCalled();
});
