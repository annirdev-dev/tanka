import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";
import { verifyAppleJws } from "../_shared/apple.ts";

const PRO_PRODUCT_ID = "tanka_pro_unlock";
const BUNDLE_ID = "com.tanka.app";

// Receives App Store Server Notifications (version 2) from Apple. Apple calls
// this URL itself, so it is deployed without Supabase's JWT check — instead
// every message is only believed if its Apple signature verifies (certificate
// chain pinned to Apple's root, see _shared/apple.ts). It keeps the account's
// Pro flag in step with what Apple says happened to the purchase:
//   REFUND / REVOKE   -> Pro off for accounts holding that purchase
//   REFUND_REVERSED   -> Pro back on
// Everything else is acknowledged and ignored.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, { status: 405 });

  let signedPayload: unknown;
  try {
    ({ signedPayload } = await req.json());
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof signedPayload !== "string") {
    return jsonResponse({ error: "Missing signedPayload" }, { status: 400 });
  }

  let notification: Record<string, unknown>;
  try {
    notification = await verifyAppleJws(signedPayload);
  } catch (err) {
    console.error("Rejected notification:", (err as Error).message);
    return jsonResponse({ error: "Invalid signature" }, { status: 401 });
  }

  const type = String(notification.notificationType ?? "");
  const data = (notification.data ?? {}) as Record<string, unknown>;

  if (type === "TEST") {
    console.log("Apple test notification received and verified");
    return jsonResponse({ ok: true });
  }
  if (data.bundleId !== BUNDLE_ID) {
    console.log(`Ignoring ${type} for another app`);
    return jsonResponse({ ok: true });
  }
  if (!["REFUND", "REVOKE", "REFUND_REVERSED"].includes(type)) {
    return jsonResponse({ ok: true });
  }

  let transaction: Record<string, unknown>;
  try {
    transaction = await verifyAppleJws(String(data.signedTransactionInfo ?? ""));
  } catch (err) {
    console.error("Rejected transaction in notification:", (err as Error).message);
    return jsonResponse({ error: "Invalid transaction signature" }, { status: 401 });
  }
  if (transaction.productId !== PRO_PRODUCT_ID || transaction.bundleId !== BUNDLE_ID) {
    return jsonResponse({ ok: true });
  }

  const originalTransactionId = String(transaction.originalTransactionId ?? "");
  if (!originalTransactionId) return jsonResponse({ error: "No transaction id" }, { status: 400 });

  const hasPro = type === "REFUND_REVERSED";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows, error } = await admin
    .from("user_data")
    .update({ has_pro: hasPro })
    .eq("apple_original_transaction_id", originalTransactionId)
    .select("user_id");
  // A failure here makes Apple retry the notification later, which is what we want.
  if (error) {
    console.error("Could not update accounts:", error.message);
    return jsonResponse({ error: "Update failed" }, { status: 500 });
  }

  console.log(`${type} (${String(data.environment)}): Pro ${hasPro ? "restored" : "removed"} for ${rows?.length ?? 0} account(s)`);
  return jsonResponse({ ok: true });
});
