// edge-functions/health.js — GET /health
import { handleHealth } from './lib/appcms_handlers.js';
import { corsHeaders } from './lib/appcms.js';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders({}) });
  }
  if (request.method !== 'GET') {
    return new Response('method not allowed', {
      status: 405, headers: corsHeaders({ 'Content-Type': 'text/plain' })
    });
  }

  try {
    return handleHealth();
  } catch (e) {
    return new Response(JSON.stringify({ status: 'error', detail: String(e && e.message || e) }), {
      status: 200,
      headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' })
    });
  }
}
