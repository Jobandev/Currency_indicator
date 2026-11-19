import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publicHtml } from './public-html';
import { defineConfig, loadEnv } from 'vite';
import { previewProjectId } from './shared/preview';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [
    {
      name: 'ratewatch-preview-isolation',
      apply: 'build',
      configResolved(config) {
        if (process.env.VERCEL_ENV !== 'preview') return;
        const env = loadEnv(config.mode, config.envDir || config.root);
        if (
          env.VITE_FIREBASE_PROJECT_ID !== previewProjectId ||
          env.VITE_FIREBASE_AUTH_DOMAIN !== previewProjectId + '.firebaseapp.com' ||
          env.VITE_FIREBASE_APP_ID !== '1:249186556086:web:50d026b184e0ba40ebae17' ||
          !env.VITE_FIREBASE_API_KEY ||
          env.VITE_API_URL ||
          env.VITE_FIREBASE_VAPID_KEY
        ) {
          throw new Error(
            'Vercel Preview requires preview Firebase web config and a same-origin API, with push disabled.',
          );
        }
      },
    },
    react(),
    tailwindcss(),
    publicHtml(),
    {
      name: 'ratewatch-worker-version',
      apply: 'build',
      async writeBundle(options, bundle) {
        if (!options.dir) return;
        const workerPath = join(options.dir, 'sw.js');
        const worker = await readFile(workerPath, 'utf8');
        const offline = await readFile(join(options.dir, 'offline.html'));
        const version = createHash('sha256')
          .update(worker)
          .update(offline)
          .update(Object.keys(bundle).sort().join('\n'))
          .digest('hex')
          .slice(0, 12);
        await writeFile(
          workerPath,
          worker.replace('ratewatch-offline-v1', 'ratewatch-offline-' + version),
        );
      },
    },
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
});
