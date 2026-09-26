// Alternate: if EdgeOne treats directory segments literally, this maps
// edge-functions/api.php.provide/vod.js -> /api.php/provide/vod (though
// that requires api.php.provide -> api.php which is nonstandard).
import { buildAppCmsHandler } from '../../lib/appcms_handlers.js';
import { corsHeaders } from '../../lib/appcms.js';

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
