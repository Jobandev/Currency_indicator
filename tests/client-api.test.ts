import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/firebase', () => ({ auth: null }));
import { api } from '../src/api';
afterEach(() => vi.restoreAllMocks());
it('explains an empty proxy error instead of throwing a JSON parsing exception', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
  await expect(api('/rates')).rejects.toThrow('API server is unavailable (HTTP 500)');
});
it('explains an HTML response from a wrong API origin', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>not the API</html>'));
  await expect(api('/rates')).rejects.toThrow('invalid response');
});
it('preserves a meaningful JSON error from the server', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: 'Verify your email' }), { status: 403 }),
  );
  await expect(api('/alerts')).rejects.toThrow('Verify your email');
});
it('returns valid API data', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ rate: 52 }])));
  expect(await api('/rates')).toEqual([{ rate: 52 }]);
});
it('explains a network failure', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(api('/rates')).rejects.toThrow('Cannot reach the API server');
});
it('explains empty successful responses', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''));
  await expect(api('/rates')).rejects.toThrow('empty response');
});
