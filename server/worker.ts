import 'dotenv/config';
const { monitor } = await import('./monitor.js');
const { db } = await import('./firebase.js');
try {
  const result = await monitor();
  console.log(JSON.stringify(result));
  if ('rateError' in result) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Monitoring failed');
  process.exitCode = 1;
} finally {
  await db.terminate();
}
