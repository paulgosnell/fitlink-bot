export default async (request, context) => {
  const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
  const SUPABASE_ANON_KEY = context.env.SUPABASE_ANON_KEY;

  const targetUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;

  const headers = {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': request.headers.get('Content-Type') || 'application/json'
  };
  
  // Forward the Telegram secret token header if present
  const telegramSecretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (telegramSecretToken) {
    headers['X-Telegram-Bot-Api-Secret-Token'] = telegramSecretToken;
  }

  const init = {
    method: request.method,
    headers,
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
      'Cache-Control': 'no-cache'
    }
  });
};

export const config = {
  path: ['/api/telegram-webhook']
};


