// Updated Complex Edge Function
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { processData } from "./utils.ts";
import { config } from "./config.ts";

console.info("Updated complex test function started - v2.0.0");

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/health") {
    return new Response(JSON.stringify({ 
      status: "healthy", 
      config,
      version: "2.0.0",
      updated: true
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (path === "/process" && req.method === "POST") {
    try {
      const body = await req.json();
      const result = processData(body);
      return new Response(JSON.stringify({
        ...result,
        version: "2.0.0"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ 
    message: "Updated complex test function",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    method: req.method,
    path
  }), {
    headers: { "Content-Type": "application/json" }
  });
});