import { verifyRequest } from './_lib/session.js';

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';

function buildAnalyzePrompt(card) {
  return `以下の名刺情報を元に3つの情報を生成。JSONのみ返してください（マークダウン不要）:
名前:${card.name || '不明'} 会社:${card.company || '不明'} 役職:${card.title || ''} URL:${card.url || ''}
{"company_overview":"会社概要200字","philosophy":"企業理念150字","talk_points":"会議トークポイント3〜5点（箇条書き）"}`;
}

function buildActionsPrompt(minute, card) {
  const who = card ? `${card.name || ''}/${card.company || ''}` : '';
  return `議事録からアクションプランを生成。JSONのみ返してください（マークダウン不要）:
タイトル:${minute.title || '会議'} 参加者:${who}
内容:${minute.content || ''}
{"actions":[{"title":"内容","priority":"high|mid|low","deadline":"YYYY-MM-DD","assignee":"担当"}]}`;
}

const OCR_INSTRUCTION = '名刺の情報をJSONで返してください（マークダウン不要）:\n{"name":"","company":"","title":"","email":"","phone":"","mobile":"","address":"","url":""}';

export default async (req) => {
  if (!verifyRequest(req, process.env.SESSION_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server not configured (ANTHROPIC_API_KEY missing)' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const kind = body && body.kind;
  let messages;
  let maxTokens;

  if (kind === 'analyze') {
    const card = body.card || {};
    messages = [{ role: 'user', content: buildAnalyzePrompt(card) }];
    maxTokens = 1000;
  } else if (kind === 'actions') {
    const minute = body.minute || {};
    const card = body.card || null;
    messages = [{ role: 'user', content: buildActionsPrompt(minute, card) }];
    maxTokens = 1000;
  } else if (kind === 'ocr') {
    const mime = body.mime || 'image/jpeg';
    const data = body.data;
    if (!data) {
      return new Response(JSON.stringify({ error: 'missing image data' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const isPdf = mime === 'application/pdf';
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: mime, data } };
    messages = [{
      role: 'user',
      content: [contentBlock, { type: 'text', text: OCR_INSTRUCTION }],
    }];
    maxTokens = 500;
  } else {
    return new Response(JSON.stringify({ error: 'unknown kind' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  let upstream;
  try {
    upstream = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'upstream fetch failed: ' + e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const msg = (data && data.error && data.error.message) || `upstream error ${upstream.status}`;
    return new Response(JSON.stringify({ error: msg }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = (data && data.content && data.content[0] && data.content[0].text) || '';
  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
