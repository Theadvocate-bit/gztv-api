// Root catch-all
import { corsHeaders } from './lib/appcms.js';

export async function onRequest(context) {
  const { request, event } = context;
  const url = new URL(request.url);
  return new Response(JSON.stringify({
    match: 'ROOT catch-all',
    path: url.pathname,
    query: url.search
  }), { status: 200, headers: corsHeaders({ 'Content-Type': 'application/json' }) });
}
