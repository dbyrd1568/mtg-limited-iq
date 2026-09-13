export interface Env {
  ASSETS: {
    fetch: typeof fetch;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

    // Proxy 17lands API requests
    if (url.pathname.startsWith('/api/17lands/')) {
      const targetPath = url.pathname.replace(/^\/api\/17lands/, '');
      const targetUrl = `https://www.17lands.com${targetPath}${url.search}`;

      try {
        const upstream = await fetch(targetUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        const headers = new Headers(upstream.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Access-Control-Allow-Headers', '*');
        if (!headers.has('Cache-Control')) {
          headers.set('Cache-Control', 'public, max-age=3600');
        }

        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers,
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Failed to fetch from 17lands' }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
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
