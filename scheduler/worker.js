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

    outcome = 'network_error';
    const response = await fetcher(url.href, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.CRON_SECRET, Accept: 'application/json' },
      redirect: 'error',
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
    if (outcome === 'network_error' && error?.name === 'TimeoutError') outcome = 'timeout';
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
