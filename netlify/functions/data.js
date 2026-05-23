import { getStore } from '@netlify/blobs';
import { verifyRequest } from './_lib/session.js';

const STORE_NAME = 'portal';
const STATE_KEY = 'state';
const MAX_BODY_BYTES = 6 * 1024 * 1024;

export default async (req) => {
  if (!verifyRequest(req, process.env.SESSION_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    const data = await store.get(STATE_KEY);
    return new Response(data || '', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    const body = await req.text();
    if (body.length > MAX_BODY_BYTES) {
      return new Response('Payload too large', { status: 413 });
    }
    try {
      JSON.parse(body);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    await store.set(STATE_KEY, body);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
};
