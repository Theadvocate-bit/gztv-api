// Catch-all for /api/* subpaths
import { corsHeaders } from '../lib/appcms.js';

export async function onRequest(context) {
  const { request, event } = context;
  const url = new URL(request.url);
  const remaining = (event?.requestContext?.pathname || url.pathname || '').replace(/^\/api\/?/, '');
  return new Response(JSON.stringify({
    match: 'api catch-all',
    path: url.pathname,
    remaining,
    query: url.search
  }), { status: 200, headers: corsHeaders({ 'Content-Type': 'application/json' }) });
}
