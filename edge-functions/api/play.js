// edge-functions/api/play.js — GET /play?vod_id=X&episode=N
// Play resolver: returns JSON with playable m3u8 URL for TVBox / custom clients

import { handlePlay } from '../lib/appcms_handlers.js';
import { corsHeaders } from '../lib/appcms.js';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders({}) });
  }

  try {
    return await handlePlay(request);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'play failed', detail: String(e && e.message || e) }), {
      status: 200,
      headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' })
    });
  }
}
