// Edge cache: in-memory LRU with TTL (per isolated edge instance).
// Optional upstream cache layer via env vars (CACHE_UPSTREAM_URL + CACHE_UPSTREAM_KEY)
// for cross-instance persistence when available.

const store = new Map();
const MAX = 512;

function env() {
  try { return (typeof process !== 'undefined' && process.env) || (globalThis.env) || {}; }
  catch (_) { return {}; }
}

function touch(key, entry) {
  store.delete(key);
  store.set(key, entry);
  if (store.size > MAX) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
}

export async function getCached(key, ttlMs, fetcher) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) {
    touch(key, hit);
    return hit.value;
  }

  const e = env();
  const upstreamUrl = e.CACHE_UPSTREAM_URL;
  const upstreamKey = e.CACHE_UPSTREAM_KEY;

  if (upstreamUrl && upstreamKey) {
    try {
      const r = await fetch(`${upstreamUrl}/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${upstreamKey}` }
      });
      if (r.ok) {
        const body = await r.json();
        if (body && body.value != null && body.exp > now) {
          store.set(key, body);
          return body.value;
        }
      }
    } catch (_) { /* fall through */ }
  }

  const value = await fetcher();
  const entry = { value, exp: Date.now() + ttlMs };
  touch(key, entry);

  if (upstreamUrl && upstreamKey) {
    try {
      await fetch(`${upstreamUrl}/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${Math.floor(ttlMs / 1000)}`,
          Authorization: `Bearer ${upstreamKey}`
        },
        body: JSON.stringify(entry)
      });
    } catch (_) { /* best effort */ }
  }

  return value;
}

export function clearCache() {
  store.clear();
}

export function cacheStats() {
  return {
    size: store.size,
    capacity: MAX,
    upstream: !!env().CACHE_UPSTREAM_URL
  };
}
