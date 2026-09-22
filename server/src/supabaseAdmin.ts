import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses row-level security, so it can read every
// user's alarms/push token to run the background price-check job. Never
// expose this key to the app; it's server-only.
// No generated Database type for this project — `any` here avoids
// supabase-js inferring `never` for .update()/.upsert() payloads, which it
// does for several methods when the schema generic is left fully unknown.
let client: ReturnType<typeof createClient<any>> | null = null;

export function getSupabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  client = createClient<any>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
