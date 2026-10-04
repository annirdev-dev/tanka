import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve((req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  // epochMs lets the app anchor time-based logic (e.g. the Pro trial window)
  // to a trusted clock instead of the device's, which can be rolled back.
  return jsonResponse({ ok: true, epochMs: Date.now() });
});
