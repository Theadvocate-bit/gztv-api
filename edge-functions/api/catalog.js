// edge-functions/api/catalog.js — GET /api/catalog
// Upstream filter tree (regions / years / genres) for client-side filter UI

import { handleCatalog } from '../lib/appcms_handlers.js';
import { corsHeaders } from '../lib/appcms.js';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders({}) });
  }

  try {
    return await handleCatalog();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'catalog failed', detail: String(e && e.message || e) }), {
      status: 200,
      headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' })
    });
  }
}
