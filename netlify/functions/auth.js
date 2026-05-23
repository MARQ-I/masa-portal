import { buildSessionCookie, clearSessionCookie } from './_lib/session.js';

export default async (req) => {
  if (req.method === 'DELETE') {
    return new Response(null, {
      status: 204,
      headers: { 'Set-Cookie': clearSessionCookie() },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const secret = process.env.SESSION_SECRET;
  const sharedPw = process.env.SHARE_PASSWORD;
  if (!secret || !sharedPw) {
    return new Response('Server not configured (SESSION_SECRET or SHARE_PASSWORD missing)', { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const pw = (body && typeof body.password === 'string') ? body.password : '';
  if (pw !== sharedPw) {
    return new Response('Unauthorized', { status: 401 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildSessionCookie(secret),
    },
  });
};
