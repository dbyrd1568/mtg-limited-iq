export interface Env {
  ASSETS: {
    fetch: typeof fetch;
  };
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// In-flight request deduplication map to prevent cache stampedes across concurrent requests
const inFlightRequests = new Map<string, Promise<Response>>();

// Worker isolate in-memory stale cache for stale-if-error protection
interface StaleCacheEntry {
  body: string;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
}
const staleMemoryCache = new Map<string, StaleCacheEntry>();

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Proxy and cache 17lands API requests
    if (url.pathname.startsWith('/api/17lands/')) {
      // Only GET and HEAD requests can be cached
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const cache = typeof caches !== 'undefined' && (caches as any).default ? (caches as any).default : null;
      const cacheKey = new Request(request.url, { method: 'GET' });

      // 1. Check Cloudflare Edge Cache (Level 3 Cache)
      if (cache) {
        try {
          const cachedResponse = await cache.match(cacheKey);
          if (cachedResponse) {
            const hitHeaders = new Headers(cachedResponse.headers);
            hitHeaders.set('Access-Control-Allow-Origin', '*');
            hitHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            hitHeaders.set('Access-Control-Allow-Headers', '*');
            hitHeaders.set('CF-Cache-Status', 'HIT');
            hitHeaders.set('X-Cache', 'HIT');
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: hitHeaders,
            });
          }
        } catch (e) {
          console.warn('[Worker] Cache match error:', e);
        }
      }

      const targetPath = url.pathname.replace(/^\/api\/17lands/, '');
      const targetUrl = `https://www.17lands.com${targetPath}${url.search}`;
      const flightKey = request.url;

      // 2. Single-Flight Request Deduplication (Stampede Guard)
      if (inFlightRequests.has(flightKey)) {
        const sharedResponse = await inFlightRequests.get(flightKey)!;
        return sharedResponse.clone();
      }

      // 3. Dispatch fetch to upstream 17lands with error recovery & stale fallback
      const fetchPromise = (async (): Promise<Response> => {
        try {
          const upstream = await fetch(targetUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });

          // Upstream success: validate, cache at edge, and serve
          if (upstream.ok) {
            const bodyText = await upstream.text();

            let isValidJson = false;
            try {
              const parsed = JSON.parse(bodyText);
              if (parsed && (Array.isArray(parsed) || Array.isArray(parsed.data))) {
                isValidJson = true;
              }
            } catch {}

            if (isValidJson) {
              const respHeaders = new Headers();
              respHeaders.set('Content-Type', 'application/json; charset=utf-8');
              respHeaders.set('Access-Control-Allow-Origin', '*');
              respHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
              respHeaders.set('Access-Control-Allow-Headers', '*');
              respHeaders.set('CF-Cache-Status', 'MISS');
              respHeaders.set('X-Cache', 'MISS');
              // 24-hour edge TTL (s-maxage=86400), 12-hour client TTL (max-age=43200), 7-day stale-while-revalidate
              respHeaders.set(
                'Cache-Control',
                'public, max-age=43200, s-maxage=86400, stale-while-revalidate=604800'
              );

              // Update in-memory stale cache for stale-if-error resilience
              staleMemoryCache.set(flightKey, {
                body: bodyText,
                status: upstream.status,
                headers: Object.fromEntries(respHeaders.entries()),
                timestamp: Date.now(),
              });

              const responseForClient = new Response(bodyText, {
                status: upstream.status,
                statusText: upstream.statusText,
                headers: respHeaders,
              });

              // Write to Cloudflare Edge Cache
              if (cache) {
                const responseForCache = responseForClient.clone();
                if (ctx && typeof ctx.waitUntil === 'function') {
                  ctx.waitUntil(cache.put(cacheKey, responseForCache));
                } else {
                  await cache.put(cacheKey, responseForCache);
                }
              }

              return responseForClient;
            }
          }

          // Upstream returned 403 / 429 / 5xx error or invalid payload
          // Check for stale memory cache fallback
          if (staleMemoryCache.has(flightKey)) {
            console.warn(
              `[Worker] Upstream returned HTTP ${upstream.status} for ${flightKey}. Serving stale cached data.`
            );
            const stale = staleMemoryCache.get(flightKey)!;
            const staleHeaders = new Headers(stale.headers);
            staleHeaders.set('CF-Cache-Status', 'STALE');
            staleHeaders.set('X-Cache', 'STALE');
            staleHeaders.set('Warning', '110 - "Response is Stale"');
            return new Response(stale.body, {
              status: 200,
              headers: staleHeaders,
            });
          }

          const errorBody = await upstream.text().catch(() => '');
          return new Response(
            JSON.stringify({
              error: `17Lands upstream returned HTTP ${upstream.status}`,
              status: upstream.status,
              details: errorBody.slice(0, 200),
            }),
            {
              status: upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        } catch (err: any) {
          // Network exception or abort: serve stale if available
          if (staleMemoryCache.has(flightKey)) {
            console.warn(
              `[Worker] Upstream fetch failed (${err?.message}) for ${flightKey}. Serving stale cached data.`
            );
            const stale = staleMemoryCache.get(flightKey)!;
            const staleHeaders = new Headers(stale.headers);
            staleHeaders.set('CF-Cache-Status', 'STALE');
            staleHeaders.set('X-Cache', 'STALE');
            staleHeaders.set('Warning', '110 - "Response is Stale"');
            return new Response(stale.body, {
              status: 200,
              headers: staleHeaders,
            });
          }

          return new Response(JSON.stringify({ error: err?.message || 'Failed to fetch from 17lands' }), {
            status: 502,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } finally {
          inFlightRequests.delete(flightKey);
        }
      })();

      inFlightRequests.set(flightKey, fetchPromise);
      const finalResult = await fetchPromise;
      return finalResult.clone();
    }

    // Pass all other requests to static assets with SPA routing fallback
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404 && !url.pathname.includes('.')) {
      const indexReq = new Request(new URL('/index.html', request.url), request);
      response = await env.ASSETS.fetch(indexReq);
    }
    return response;
  },
};
