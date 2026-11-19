/* global Response, DOMException, Headers */
import { expect, it, vi } from 'vitest';
import { invokeMonitor } from '../scheduler/worker.js';

const env = {
  MONITOR_URL: 'https://preview.example.test/api/jobs/monitor',
  CRON_SECRET: 'test-secret-'.repeat(3),
};
const event = { scheduledTime: 1800000000000 };

it.each([
  [{ processed: 0 }, 'completed'],
  [{ busy: true }, 'busy'],
])('calls the backend once and records its outcome', async (body, outcome) => {
  const send = vi.fn().mockResolvedValue(Response.json(body));
  const log = vi.fn();
  await expect(invokeMonitor(event, env, send, log)).resolves.toBe(outcome);
  expect(send).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledWith(
    env.MONITOR_URL,
    expect.objectContaining({
      method: 'POST',
      redirect: 'manual',
      headers: expect.objectContaining({ Authorization: 'Bearer ' + env.CRON_SECRET }),
    }),
  );
  expect(log.mock.calls[0][0]).not.toContain(env.CRON_SECRET);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
    outcome,
    status: 200,
    scheduledAt: event.scheduledTime,
  });
});

it('rejects unsafe destinations and fails HTTP or timeout errors without replaying a POST', async () => {
  const log = vi.fn();
  const send = vi
    .fn()
    .mockResolvedValueOnce(new Response('private response', { status: 503 }))
    .mockRejectedValueOnce(new DOMException('expired', 'TimeoutError'));
  await expect(
    invokeMonitor(
      event,
      { ...env, MONITOR_URL: 'http://preview.example.test/api/jobs/monitor' },
      send,
      log,
    ),
  ).rejects.toThrow('configuration_error');
  expect(send).not.toHaveBeenCalled();
  await expect(invokeMonitor(event, env, send, log)).rejects.toThrow('http_error');
  await expect(invokeMonitor(event, env, send, log)).rejects.toThrow('timeout');
  expect(send).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(log.mock.calls)).not.toContain('private response');
});

it('blocks the known production hostname in preview before making any request', async () => {
  const send = vi.fn();
  await expect(
    invokeMonitor(
      event,
      {
        ...env,
        PREVIEW_ONLY: 'true',
        MONITOR_URL: 'https://currencyindicators.vercel.app/api/jobs/monitor',
      },
      send,
      vi.fn(),
    ),
  ).rejects.toThrow('configuration_error');
  expect(send).not.toHaveBeenCalled();
});

it('adds the Vercel automation bypass header without putting it in the URL or logs', async () => {
  const log = vi.fn();
  const send = vi.fn().mockResolvedValue(Response.json({ processed: 0 }));
  await invokeMonitor(
    event,
    { ...env, VERCEL_AUTOMATION_BYPASS_SECRET: 'preview-bypass-secret' },
    send,
    log,
  );
  expect(send).toHaveBeenCalledWith(
    env.MONITOR_URL,
    expect.objectContaining({
      headers: expect.objectContaining({
        'x-vercel-protection-bypass': 'preview-bypass-secret',
      }),
    }),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain('preview-bypass-secret');
});

it('records a 302 as an HTTP redirect instead of network_error', async () => {
  const log = vi.fn();
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
  await expect(invokeMonitor(event, env, send, log)).rejects.toThrow('http_error');
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
    outcome: 'http_error',
    status: 302,
  });
});

const shareEnv = {
  ...env,
  PREVIEW_ONLY: 'true',
  VERCEL_PREVIEW_SHARE_URL: 'https://preview.example.test/?_vercel_share=local-fixture',
};

it('exchanges the Preview Shareable Link and sends one authenticated POST without following redirects', async () => {
  const headers = new Headers({ Location: '/' });
  headers.append('Set-Cookie', '_vercel_jwt=test-cookie; Secure; HttpOnly; Path=/');
  headers.append('Set-Cookie', '_vercel_sso_nonce=test-nonce; Secure; Path=/');
  headers.append('Set-Cookie', 'unrelated=ignored; Path=/');
  const send = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 307, headers }))
    .mockResolvedValueOnce(new Response(null, { status: 302 }));
  const log = vi.fn();
  await expect(invokeMonitor(event, shareEnv, send, log)).rejects.toThrow('http_error');
  expect(send).toHaveBeenNthCalledWith(
    1,
    shareEnv.VERCEL_PREVIEW_SHARE_URL,
    expect.objectContaining({ redirect: 'manual' }),
  );
  expect(send.mock.calls[0][1]).not.toHaveProperty('headers');
  expect(send).toHaveBeenNthCalledWith(
    2,
    env.MONITOR_URL,
    expect.objectContaining({
      method: 'POST',
      redirect: 'manual',
      headers: expect.objectContaining({
        Cookie: '_vercel_jwt=test-cookie; _vercel_sso_nonce=test-nonce',
        Authorization: 'Bearer ' + env.CRON_SECRET,
      }),
    }),
  );
  expect(send).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/test-cookie|local-fixture|test-secret/);
});

it('rejects off-origin share links and stops at a redirected bootstrap', async () => {
  const send = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 307,
      headers: {
        Location: 'https://other.example.test/',
        'Set-Cookie': '_vercel_jwt=test-cookie; Secure; Path=/',
      },
    }),
  );
  const log = vi.fn();
  await expect(
    invokeMonitor(
      event,
      {
        ...shareEnv,
        VERCEL_PREVIEW_SHARE_URL: 'https://other.example.test/?_vercel_share=fixture',
      },
      send,
      log,
    ),
  ).rejects.toThrow('configuration_error');
  expect(send).not.toHaveBeenCalled();
  await expect(invokeMonitor(event, shareEnv, send, log)).rejects.toThrow('preview_access_error');
  expect(send).toHaveBeenCalledOnce();
});
