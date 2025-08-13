import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  // Simple health check
  if (req.url.includes('/health')) {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (req.method === 'POST') {
    try {
      const update = await req.json();
      console.log("Received update:", JSON.stringify(update, null, 2));
      
      // For now, just log and return success
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error("Error:", error);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
});