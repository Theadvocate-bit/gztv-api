// edge-functions/api/appcms.js — GET/POST /api/appcms
// Apple CMS V10 collector alias

import { buildAppCmsHandler } from '../lib/appcms_handlers.js';
import { corsHeaders } from '../lib/appcms.js';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders({}) });
  }

  try {
    return await buildAppCmsHandler(request);
  } catch (e) {
    return new Response(JSON.stringify({
      code: 0, msg: 'Internal error', detail: String(e && e.message || e)
    }), {
      status: 200,
      headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' })
    });
  }
}
