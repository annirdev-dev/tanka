import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import {
  PLAY_PACKAGE,
  isPlayPurchaseToken,
  judgePlayPurchase,
  lookUpPlayPurchase,
  parseServiceAccount,
  playAccessToken,
} from "../_shared/google.ts";

const PRO_PRODUCT_ID = "tanka_pro_unlock";

// Android twin of confirm-purchase (which handles Apple). Marks an account Pro
// only for a purchase Google Play itself confirms for this app and product:
// the token must exist and must not be refunded or still pending. Kept as a
// separate function so the iOS path is untouched.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, { status: 405 });

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );
  const { data: userRes } = await authClient.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return jsonResponse({ error: "Not signed in" }, { status: 401 });

  let body: { productId?: string; purchaseToken?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.productId !== PRO_PRODUCT_ID) {
    return jsonResponse({ error: "Unknown product" }, { status: 400 });
  }
  if (!isPlayPurchaseToken(body.purchaseToken)) {
    return jsonResponse({ error: "Missing or invalid purchaseToken" }, { status: 400 });
  }
  const purchaseToken = body.purchaseToken;

  const serviceAccount = parseServiceAccount(Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"));
  if (!serviceAccount) {
    console.error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set or not valid");
    return jsonResponse({ error: "Purchase could not be verified" }, { status: 503 });
  }

  let lookup;
  try {
    const accessToken = await playAccessToken(serviceAccount);
    if (!accessToken) return jsonResponse({ error: "Purchase could not be verified" }, { status: 503 });
    lookup = await lookUpPlayPurchase(accessToken, PLAY_PACKAGE, PRO_PRODUCT_ID, purchaseToken);
  } catch (err) {
    console.error("Google Play lookup failed:", (err as Error).message);
    return jsonResponse({ error: "Purchase could not be verified" }, { status: 503 });
  }
  // Google couldn't answer: say so (the app retries later) rather than
  // pretending the purchase is fake.
  if (lookup.kind === "unavailable") {
    return jsonResponse({ error: "Purchase could not be verified" }, { status: 503 });
  }
  if (lookup.kind === "not_found") {
    return jsonResponse({ error: "Purchase could not be verified" }, { status: 403 });
  }

  const verdict = judgePlayPurchase(lookup.purchase);
  if (!verdict.ok) {
    if (verdict.code === "revoked") {
      // Refunded: the app clears its local Pro unlock on this code.
      return jsonResponse({ error: "Purchase was refunded", code: "revoked" }, { status: 403 });
    }
    if (verdict.code === "pending") {
      return jsonResponse({ error: "Purchase is still pending", code: "pending" }, { status: 403 });
    }
    return jsonResponse({ error: "Purchase is not valid for this app", code: "invalid" }, { status: 403 });
  }

  // Remember which Google purchase gave this account Pro, so a later refund
  // (google-refunds) can find the accounts to switch Pro off for.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("user_data").upsert({
    user_id: userId,
    has_pro: true,
    google_purchase_token: purchaseToken,
  });
  if (error) return jsonResponse({ error: error.message }, { status: 500 });

  console.log(`Pro recorded (Google Play, ${verdict.environment})`);
  return jsonResponse({ ok: true, environment: verdict.environment });
});
