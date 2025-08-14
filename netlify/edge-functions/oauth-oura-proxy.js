export default async (request) => {
  const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXhlZm94Z2ptZGx2dnRmbm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NjQ4ODAsImV4cCI6MjA1MDU0MDg4MH0.xJVtJr4M_Hg1fGQ7qBGYXoW0Vx6yivfYnWCLw9_T5nE';

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/oauth-oura/, '/oauth-oura');
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
  const contentType = response.headers.get('Content-Type') || 'text/html; charset=UTF-8';

  return new Response(bodyText, {
    status: response.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    }
  });
};

export const config = {
  path: ['/oauth-oura', '/oauth-oura/*']
};


