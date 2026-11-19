import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import { expect, it, vi } from 'vitest';

const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function pushFixture() {
  const handlers = new Map();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  runInNewContext(worker, {
    self: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      registration: { showNotification },
    },
  });
  return { push: handlers.get('push'), showNotification };
}

it.each([true, false])('displays a validated push payload, nested=%s', (nested) => {
  const { push, showNotification } = pushFixture();
  const data = { path: '/dashboard#alert-test_1', tag: 'alert-test_1-1' };
  const waitUntil = vi.fn();
  push({ data: { json: () => (nested ? { data } : data) }, waitUntil });
  expect(waitUntil).toHaveBeenCalledOnce();
  expect(showNotification).toHaveBeenCalledWith(
    'RateWatch',
    expect.objectContaining({
      data: { path: data.path },
      tag: data.tag,
    }),
  );
});

it('ignores notification payloads with invalid destinations', () => {
  const { push, showNotification } = pushFixture();
  push({ data: { json: () => ({ path: 'https://example.test/', tag: 'alert-test' }) } });
  expect(showNotification).not.toHaveBeenCalled();
});
