// Netlify Function: Proxy oauth-test to Supabase Edge Function, adding Authorization header
exports.handler = async (event) => {
  const supabaseProjectRef = "umixefoxgjmdlvvtfnmr";
  const base = `https://${supabaseProjectRef}.functions.supabase.co/oauth-test`;
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  const path = event.path.replace("/.netlify/functions/oauth-test-proxy", "");
  const targetUrl = `${base}${path || "/"}${event.rawQuery ? `?${event.rawQuery}` : ""}`;

  const headers = { "content-type": event.headers["content-type"] || "application/json" };
  if (anonKey) headers["authorization"] = `Bearer ${anonKey}`;

  const init = {
    method: event.httpMethod,
    headers,
    body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
  };

  try {
    const resp = await fetch(targetUrl, init);
    const text = await resp.text();
    
    // Preserve Content-Type headers for proper response handling
    const contentType = resp.headers.get("content-type") || "application/json";
    
    return { 
      statusCode: resp.status, 
      headers: { 
        "Content-Type": contentType,
        "Cache-Control": "no-cache" // Prevent caching issues
      }, 
      body: text 
    };
  } catch (e) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ ok: false, error: String(e.message) }) 
    };
  }
};
