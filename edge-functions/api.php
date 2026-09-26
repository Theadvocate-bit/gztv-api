// edge-functions/api.php — intercept the AppCMS standard path /api.php/provide/vod
// Apple CMS / TVBox clients default to /api.php/provide/vod. EdgeOne file-per-route
// accepts a .php-suffix filename and maps it to the corresponding URL.

import { buildAppCmsHandler } from './lib/appcms_handlers.js';
import { corsHeaders } from './lib/appcms.js';

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
