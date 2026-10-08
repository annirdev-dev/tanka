import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, handleOptions, requireCronAuth } from "../_shared/cors.ts";
import {
  PLAY_PACKAGE,
  listVoidedPurchaseTokens,
  parseServiceAccount,
  playAccessToken,
} from "../_shared/google.ts";

// Look this far back each run. Runs are hourly, so the window only has to
// cover outages; marking an already-removed purchase again changes nothing.
const LOOKBACK_MS = 3 * 24 * 60 * 60_000;
const TOKENS_PER_QUERY = 100;

// Cron-only. Google Play has no instant refund callback without extra
// infrastructure, so once an hour this asks Google which one-time purchases
// were voided (refunded / charged back) and switches Pro off for the accounts
// that were holding them. Apple refunds are handled by apple-notifications.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  const forbidden = requireCronAuth(req);
  if (forbidden) return forbidden;

  const serviceAccount = parseServiceAccount(Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"));
  if (!serviceAccount) {
    return jsonResponse({ ok: false, reason: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set" });
  }

  let tokens: string[] | null;
  try {
    const accessToken = await playAccessToken(serviceAccount);
    if (!accessToken) return jsonResponse({ ok: false, reason: "no Google access token" });
    tokens = await listVoidedPurchaseTokens(accessToken, PLAY_PACKAGE, Date.now() - LOOKBACK_MS);
  } catch (err) {
    console.error("google-refunds failed:", (err as Error).message);
    return jsonResponse({ ok: false, reason: "Google lookup failed" });
  }
  if (tokens === null) return jsonResponse({ ok: false, reason: "Google couldn't answer" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let accountsUpdated = 0;
  for (let i = 0; i < tokens.length; i += TOKENS_PER_QUERY) {
    const batch = tokens.slice(i, i + TOKENS_PER_QUERY);
    const { data, error } = await admin
      .from("user_data")
      .update({ has_pro: false })
      .in("google_purchase_token", batch)
      .eq("has_pro", true)
      .select("user_id");
    if (error) {
      console.error("google-refunds: could not update accounts:", error.message);
      return jsonResponse({ ok: false, reason: "database update failed" });
    }
    accountsUpdated += data?.length ?? 0;
  }

  console.log(`google-refunds summary ${JSON.stringify({ voidedPurchases: tokens.length, accountsUpdated })}`);
  return jsonResponse({ ok: true, voidedPurchases: tokens.length, accountsUpdated });
});
