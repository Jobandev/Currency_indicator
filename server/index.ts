import 'dotenv/config';
const { app } = await import('./app.js');
const express = (await import('express')).default;
const path = await import('node:path');
app.use(express.static(path.resolve('dist')));
app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () =>
  console.log('RateWatch API listening'),
);
