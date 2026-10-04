export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...(init?.headers ?? {}) },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

// Cron-only functions (push-alerts, sync-stations) run privileged, unmetered
// work against every user's data — Supabase's gateway only checks that the
// caller presents *some* valid key, which the public anon key satisfies too,
// so without this check anyone holding the app's anon key could invoke them
// directly. pg_cron calls these with `Authorization: Bearer
// <service_role_key>` (see supabase/migrations/20260922190000_schedule_backend_jobs.sql),
// so requiring an exact match locks them to that caller alone.
export function requireCronAuth(req: Request): Response | null {
  const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (req.headers.get("Authorization") !== expected) {
    return jsonResponse({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
