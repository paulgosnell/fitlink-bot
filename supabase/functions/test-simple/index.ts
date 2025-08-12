import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

serve((req) => {
  return new Response("Hello World!", {
    headers: { "content-type": "text/plain" },
  })
})