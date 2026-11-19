async function previewCookie(share, fetcher) {
  const response = await fetcher(share.href, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  const location = response.headers.get('location');
  if (response.status !== 307 || !location) throw new Error();
  const target = new URL(location, share);
  if (target.origin !== share.origin || target.username || target.password) throw new Error();
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((cookie) => /^_vercel_(jwt|sso_nonce)=[^\s;,]+$/.test(cookie));
  if (cookies.filter((cookie) => cookie.startsWith('_vercel_jwt=')).length !== 1) throw new Error();
  return cookies.join('; ');
}

export async function invokeMonitor(event, env, fetcher = fetch, log = console.log) {
  const started = Date.now();
  let outcome = 'configuration_error';
  let status;
  try {
    const url = new URL(env.MONITOR_URL);
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/api/jobs/monitor' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (env.PREVIEW_ONLY === 'true' &&
        url.hostname.toLowerCase().replace(/\.$/, '') === 'currencyindicators.vercel.app') ||
      typeof env.CRON_SECRET !== 'string' ||
      env.CRON_SECRET.length < 32
    )
      throw new Error();

    const headers = {
      Authorization: 'Bearer ' + env.CRON_SECRET,
      Accept: 'application/json',
    };
    const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (env.VERCEL_PREVIEW_SHARE_URL) {
      const share = new URL(env.VERCEL_PREVIEW_SHARE_URL);
      if (
        env.PREVIEW_ONLY !== 'true' ||
        bypass ||
        share.origin !== url.origin ||
        share.pathname !== '/' ||
        share.username ||
        share.password ||
        share.hash ||
        share.searchParams.size !== 1 ||
        !share.searchParams.get('_vercel_share')
      )
        throw new Error();
      outcome = 'preview_access_error';
      headers.Cookie = await previewCookie(share, fetcher);
    } else if (typeof bypass === 'string' && bypass.length > 0) {
      headers['x-vercel-protection-bypass'] = bypass;
    }
    outcome = 'network_error';
    const response = await fetcher(url.href, {
      method: 'POST',
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(310000),
    });
    status = response.status;
    outcome = 'http_error';
    if (!response.ok) throw new Error();
    outcome = 'invalid_response';
    const result = await response.json();
    if (result?.busy === true) outcome = 'busy';
    else if (Number.isSafeInteger(result?.processed) && result.processed >= 0 && !result.rateError)
      outcome = 'completed';
    else throw new Error();
  } catch (error) {
    if (outcome === 'network_error' && ['TimeoutError', 'AbortError'].includes(error?.name))
      outcome = 'timeout';
    throw new Error('RateWatch monitor: ' + outcome);
  } finally {
    log(
      JSON.stringify({
        event: 'ratewatch_monitor_invocation',
        outcome,
        status,
        scheduledAt: event.scheduledTime,
        elapsedMs: Date.now() - started,
      }),
    );
  }
  return outcome;
}

export default {
  async scheduled(event, env) {
    await invokeMonitor(event, env);
  },
};
