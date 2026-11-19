import { auth } from './firebase';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await auth?.currentUser?.getIdToken();
  const timeout = AbortSignal.timeout(25000);
  const signal =
    options.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
  let response: Response;
  try {
    response = await fetch((import.meta.env.VITE_API_URL || '') + '/api' + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...options.headers,
      },
      signal,
    });
  } catch (error) {
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
      throw new Error(
        'The API request timed out. Check that the backend is running and Firebase Admin is configured.',
      );
    }
    throw new Error(
      'Cannot reach the API server. Start the app with npm run dev and check the backend terminal.',
    );
  }
  const body = await response.text();
  let result: unknown;
  try {
    result = body.trim() ? JSON.parse(body) : undefined;
  } catch {
    throw new Error(
      'The API returned an invalid response (HTTP ' +
        response.status +
        '). Check that the backend is running on port 3001.',
    );
  }
  if (!response.ok) {
    const message =
      result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
        ? result.error
        : undefined;
    throw new Error(
      message ||
        'The API server is unavailable (HTTP ' +
          response.status +
          '). Start npm run dev and check the backend terminal.',
    );
  }
  if (result === undefined)
    throw new Error(
      'The API returned an empty response. Check the backend terminal and API configuration.',
    );
  return result as T;
}
