import { app } from '../server/app.js';

// Vercel owns the HTTP listener; reuse the same API as local development.
export default app;
