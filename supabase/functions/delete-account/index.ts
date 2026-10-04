import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

const BUNDLE_ID = "com.tanka.app";
const APPLE_ID_HOST = "https://appleid.apple.com";

// Short-lived proof to Apple that this server owns the app's Sign in with
// Apple key (APPLE_SIWA_* / APPLE_TEAM_ID secrets in Supabase).
async function appleClientSecret(): Promise<string> {
  const keyId = Deno.env.get("APPLE_SIWA_KEY_ID");
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const pem = Deno.env.get("APPLE_SIWA_PRIVATE_KEY");
  if (!keyId || !teamId || !pem) throw new Error("Sign in with Apple key is not configured");
  const key = await importPKCS8(pem.replace(/\\n/g, "\n"), "ES256");
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .setAudience(APPLE_ID_HOST)
    .setSubject(BUNDLE_ID)
    .sign(key);
}

async function appleForm(path: string, fields: Record<string, string>): Promise<Response> {
  return await fetch(`${APPLE_ID_HOST}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

// Apple requires an app that lets people delete their account to also revoke
// the Sign in with Apple link. The authorization code from a fresh Apple
// sign-in is traded for a token, and that token is revoked.
async function revokeAppleAccess(authorizationCode: string): Promise<void> {
  const clientSecret = await appleClientSecret();
  const tokenRes = await appleForm("/auth/token", {
    client_id: BUNDLE_ID,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: "authorization_code",
  });
  const tokens = (await tokenRes.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
  };
  if (!tokenRes.ok) throw new Error(`Apple token exchange failed: ${tokens.error ?? tokenRes.status}`);

  const token = tokens.refresh_token ?? tokens.access_token;
  if (!token) throw new Error("Apple returned no token to revoke");
  const revokeRes = await appleForm("/auth/revoke", {
    client_id: BUNDLE_ID,
    client_secret: clientSecret,
    token,
    token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
  });
  if (!revokeRes.ok) throw new Error(`Apple revoke failed: ${revokeRes.status}`);
}

// Deletes the signed-in user's account. For accounts that use Sign in with
// Apple it first removes Apple's link (best effort — a failure there is logged
// but never stops the deletion, so nobody is left unable to erase their
// data), then runs delete_own_account() as the user, which remembers the used
// trial and deletes the auth user and everything tied to it.
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
  const user = userRes.user;
  if (!user) return jsonResponse({ error: "Not signed in" }, { status: 401 });

  let body: { appleAuthorizationCode?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine for accounts without an Apple link
  }

  let appleRevoked: boolean | null = null; // null = account has no Apple link
  if ((user.identities ?? []).some((identity) => identity.provider === "apple")) {
    if (!body.appleAuthorizationCode) {
      console.error("Apple account deleted without an authorization code; link not revoked");
      appleRevoked = false;
    } else {
      try {
        await revokeAppleAccess(body.appleAuthorizationCode);
        appleRevoked = true;
        console.log("Apple Sign in link revoked");
      } catch (err) {
        console.error("Could not revoke Apple access:", (err as Error).message);
        appleRevoked = false;
      }
    }
  }

  const { error } = await authClient.rpc("delete_own_account");
  if (error) return jsonResponse({ error: error.message }, { status: 500 });
  console.log(`Account deleted (appleRevoked: ${appleRevoked})`);

  return jsonResponse({ ok: true, appleRevoked });
});
