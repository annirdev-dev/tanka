import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, decodeJwt, importPKCS8 } from "npm:jose@5";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { verifyAppleJws } from "../_shared/apple.ts";

const PRO_PRODUCT_ID = "tanka_pro_unlock";
const BUNDLE_ID = "com.tanka.app";

// Apple's App Store Server API. A purchase is only believed once Apple itself
// confirms it for this app: production first, then the sandbox, because
// TestFlight and App Review purchases only exist in the sandbox.
const APPLE_HOSTS: { environment: string; base: string }[] = [
  { environment: "Production", base: "https://api.storekit.itunes.apple.com" },
  { environment: "Sandbox", base: "https://api.storekit-sandbox.itunes.apple.com" },
];

// Short-lived ES256 token proving to Apple that this server owns the app's
// In-App Purchase key (APPLE_IAP_* secrets in Supabase).
async function appleToken(): Promise<string | null> {
  const keyId = Deno.env.get("APPLE_IAP_KEY_ID");
  const issuerId = Deno.env.get("APPLE_IAP_ISSUER_ID");
  const pem = Deno.env.get("APPLE_IAP_PRIVATE_KEY");
  if (!keyId || !issuerId || !pem) return null;
  // Pasted keys sometimes arrive with literal "\n" instead of real newlines.
  const key = await importPKCS8(pem.replace(/\\n/g, "\n"), "ES256");
  return await new SignJWT({ bid: BUNDLE_ID })
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuerId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

// Looks the transaction up at Apple. The answer comes straight from Apple's
// servers over TLS, authenticated with our own key, so its contents are
// trusted as-is. Three outcomes:
//   found        Apple knows the transaction (production or sandbox);
//   not_found    both environments answered "no such transaction";
//   unavailable  Apple's API refused or failed (e.g. the production API stays
//                locked until the app's first release) — Apple couldn't say.
type Lookup =
  | { kind: "found"; environment: string; info: Record<string, unknown> }
  | { kind: "not_found" }
  | { kind: "unavailable" };

async function lookUpAppleTransaction(token: string, transactionId: string): Promise<Lookup> {
  let unavailable = false;
  for (const { environment, base } of APPLE_HOSTS) {
    const res = await fetch(`${base}/inApps/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { signedTransactionInfo?: string };
      if (!body.signedTransactionInfo) continue;
      return {
        kind: "found",
        environment,
        info: decodeJwt(body.signedTransactionInfo) as Record<string, unknown>,
      };
    }
    // 404 = unknown there (expected for sandbox purchases on the production
    // host); anything else means Apple couldn't answer.
    if (res.status !== 404) {
      unavailable = true;
      console.error(`Apple ${environment} lookup returned ${res.status}`);
    }
  }
  return unavailable ? { kind: "unavailable" } : { kind: "not_found" };
}

// The phone can also hand over the signed record StoreKit gave it. Apple's
// signature on it is checked here against Apple's pinned root, so it can't be
// forged — but it is only a snapshot (it can't show a refund made after it
// was signed), so it is used only when Apple's own API couldn't answer.
async function verifySignedTransaction(
  signedTransaction: string,
  transactionId: string
): Promise<{ environment: string; info: Record<string, unknown> }> {
  const info = await verifyAppleJws(signedTransaction);
  if (String(info.transactionId) !== transactionId) throw new Error("Transaction id mismatch");
  return { environment: String(info.environment ?? "Unknown"), info };
}

// Marks an account Pro only for a purchase Apple confirms: the transaction
// must exist, be for this app and this product, and not be refunded/revoked.
// (Refunds that happen later aren't noticed yet — that needs App Store Server
// Notifications.) Android purchases can't be verified here yet.
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

  let body: { productId?: string; transactionId?: string; platform?: string; signedTransaction?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.productId !== PRO_PRODUCT_ID) {
    return jsonResponse({ error: "Unknown product" }, { status: 400 });
  }
  if (body.platform === "android") {
    return jsonResponse(
      { error: "Android purchases can't be verified yet" },
      { status: 501 }
    );
  }
  // Apple transaction ids are plain digits; anything else never reaches the URL.
  const transactionId = body.transactionId ?? "";
  if (!/^\d{5,20}$/.test(transactionId)) {
    return jsonResponse({ error: "Missing or invalid transactionId" }, { status: 400 });
  }

  const signedTransaction =
    typeof body.signedTransaction === "string" && body.signedTransaction.split(".").length === 3
      ? body.signedTransaction
      : null;

  let lookup: Lookup = { kind: "unavailable" };
  try {
    const token = await appleToken();
    if (token) lookup = await lookUpAppleTransaction(token, transactionId);
    else console.error("APPLE_IAP_* secrets are not set");
  } catch (err) {
    console.error("Apple lookup failed:", (err as Error).message);
  }

  let found: { environment: string; info: Record<string, unknown> } | null = null;
  let via = "Apple API";
  if (lookup.kind === "found") {
    found = lookup;
    // Diagnostic only (never changes the outcome): does the signed record the
    // phone sent verify too? Shows in the log whether the backup path works.
    if (signedTransaction) {
      verifySignedTransaction(signedTransaction, transactionId).then(
        () => console.log("Signed receipt from the phone also verifies"),
        (err) => console.log("Signed receipt from the phone did NOT verify:", (err as Error).message)
      );
    }
  } else if (lookup.kind === "unavailable" && signedTransaction) {
    try {
      found = await verifySignedTransaction(signedTransaction, transactionId);
      via = "signed receipt";
    } catch (err) {
      console.error("Signed receipt rejected:", (err as Error).message);
    }
  }
  if (!found) {
    return jsonResponse({ error: "Purchase could not be verified" }, { status: 403 });
  }
  const { info, environment } = found;
  // Refunded / revoked: the app clears its local Pro unlock on this code.
  if (info.revocationDate != null) {
    return jsonResponse({ error: "Purchase was refunded", code: "revoked" }, { status: 403 });
  }
  if (info.bundleId !== BUNDLE_ID || info.productId !== PRO_PRODUCT_ID) {
    console.error("Rejected transaction", { bundleId: info.bundleId, productId: info.productId });
    return jsonResponse({ error: "Purchase is not valid for this app", code: "invalid" }, { status: 403 });
  }

  // Remember which Apple purchase this is, so a later refund notification
  // (apple-notifications) can find the accounts to switch Pro off for.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("user_data").upsert({
    user_id: userId,
    has_pro: true,
    apple_original_transaction_id: String(info.originalTransactionId ?? transactionId),
  });
  if (error) return jsonResponse({ error: error.message }, { status: 500 });

  console.log(`Pro recorded (${environment}, via ${via})`);
  return jsonResponse({ ok: true, environment });
});
