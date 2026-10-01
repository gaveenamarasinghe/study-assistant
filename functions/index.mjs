import { onRequest } from 'firebase-functions/v2/https';
import app from './lib/server.mjs';

export const api = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    secrets: ['GEMINI_API_KEY'],
  },
  app,
);