// edge-functions/api/m3u8.js — GET /api/m3u8?url=...
// M3U8 passthrough proxy for players that need referrer/UA control

import { handleM3u8 } from '../lib/appcms_handlers.js';
import { corsHeaders } from '../lib/appcms.js';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders({}) });
  }

  try {
    return await handleM3u8(request);
  } catch (e) {
    return new Response('proxy failed: ' + (e && e.message || e), {
      status: 502,
      headers: corsHeaders({ 'Content-Type': 'text/plain; charset=utf-8' })
    });
  }
}
