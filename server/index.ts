import 'dotenv/config';
import { publicPage } from '../shared/public-pages.js';
const { app } = await import('./app.js');
const express = (await import('express')).default;
const path = await import('node:path');
app.use(express.static(path.resolve('dist')));
app.get('/{*path}', (req, res) => {
  const route = req.path.replace(/\/$/, '') || '/';
  if (publicPage(route))
    return res.sendFile(
      path.resolve('dist', route === '/' ? 'index.html' : route.slice(1) + '.html'),
    );
  const known =
    /^\/(?:dashboard|settings|login|register|forgot-password|unsubscribe|alerts\/(?:new|[^/]+\/edit))$/.test(
      route,
    );
  return res.status(known ? 200 : 404).sendFile(path.resolve('dist/app-shell.html'));
});
app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () =>
  console.log('RateWatch API listening'),
);
