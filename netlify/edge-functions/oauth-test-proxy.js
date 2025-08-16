export default async (request, context) => {
  try {
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    const SUPABASE_ANON_KEY = context?.env?.VITE_SUPABASE_ANON_KEY || 
                              context?.env?.SUPABASE_ANON_KEY ||
                              Deno?.env?.get?.('VITE_SUPABASE_ANON_KEY') ||
                              Deno?.env?.get?.('SUPABASE_ANON_KEY');

    if (!SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Missing SUPABASE_ANON_KEY',
        debug: {
          context_env_keys: context?.env ? Object.keys(context.env) : 'no context.env',
          has_context: !!context,
          has_deno: typeof Deno !== 'undefined'
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/oauth-test(-nocache)?/, '/oauth-test');
    const targetUrl = `${SUPABASE_URL}/functions/v1${path}${url.search}`;

    const init = {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      redirect: 'manual'
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    const response = await fetch(targetUrl, init);
    const bodyText = await response.text();
    const contentType = response.headers.get('Content-Type') || 'application/json';

    return new Response(bodyText, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Debug-Timestamp': Date.now().toString()
      }
    });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 500 });
  }
};

export const config = {
  path: ['/oauth-test', '/oauth-test/*', '/oauth-test-nocache', '/oauth-test-nocache/*']
};


