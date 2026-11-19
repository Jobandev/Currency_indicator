/* global Response, DOMException */
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
      redirect: 'error',
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
