import { SignJWT, importPKCS8 } from "npm:jose@5";

// Google Play side of purchase checking. The server proves who it is to Google
// with a service account (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON secret) that has
// been given "view financial data" access to this app in Play Console, then
// asks Google's Android Publisher API about a purchase token the phone sent.
// The answer comes straight from Google over TLS, so it is trusted as-is.

export const PLAY_PACKAGE = "com.tanka.app";

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";

type FetchFn = typeof fetch;

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

// The secret holds the JSON key file Google generates for the service account.
export function parseServiceAccount(raw: string | undefined | null): ServiceAccount | null {
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (typeof sa?.client_email === "string" && typeof sa?.private_key === "string") {
      return sa as ServiceAccount;
    }
  } catch {
    // not JSON
  }
  return null;
}

// Purchase tokens are opaque, URL-safe strings of a couple hundred characters;
// anything else never reaches a URL.
export function isPlayPurchaseToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{20,2000}$/.test(value);
}

// Short-lived OAuth access token for the Android Publisher API.
export async function playAccessToken(sa: ServiceAccount, fetchFn: FetchFn = fetch): Promise<string | null> {
  const tokenUrl = sa.token_uri ?? DEFAULT_TOKEN_URL;
  // Pasted keys sometimes arrive with literal "\n" instead of real newlines.
  const key = await importPKCS8(sa.private_key.replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience(tokenUrl)
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(key);
  const res = await fetchFn(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    console.error(`Google token request returned ${res.status}`);
    return null;
  }
  const body = (await res.json()) as { access_token?: string };
  return body.access_token ?? null;
}

// Fields of Google's ProductPurchase that matter here.
export interface PlayProductPurchase {
  purchaseState?: number; // 0 purchased, 1 canceled (refunded), 2 pending
  purchaseType?: number; // 0 = bought by a license tester; absent for real purchases
  orderId?: string;
  purchaseTimeMillis?: string;
}

//   found        Google knows the token for this app and product;
//   not_found    Google says no such purchase;
//   unavailable  Google couldn't answer (service account not allowed yet, outage, rate limit).
export type PlayLookup =
  | { kind: "found"; purchase: PlayProductPurchase }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export async function lookUpPlayPurchase(
  accessToken: string,
  packageName: string,
  productId: string,
  purchaseToken: string,
  fetchFn: FetchFn = fetch
): Promise<PlayLookup> {
  const url = `${API}/${packageName}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.ok) return { kind: "found", purchase: (await res.json()) as PlayProductPurchase };
  if (res.status === 404) {
    // "applicationNotFound" means Google can't see this app from our service
    // account (permission not granted yet / not propagated) — a setup problem,
    // not a verdict on the purchase.
    const body = (await res.json().catch(() => null)) as {
      error?: { errors?: { reason?: string }[]; details?: { reason?: string }[] };
    } | null;
    const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.details?.[0]?.reason;
    if (reason === "applicationNotFound") {
      console.error("Google Play lookup: application not found for this service account");
      return { kind: "unavailable" };
    }
    return { kind: "not_found" };
  }
  // 400/410: Google doesn't recognise (or no longer honours) this token.
  if (res.status === 400 || res.status === 410) return { kind: "not_found" };
  console.error(`Google Play lookup returned ${res.status}`);
  return { kind: "unavailable" };
}

export type PlayVerdict =
  | { ok: true; environment: "Production" | "Test" }
  | { ok: false; code: "revoked" | "pending" | "invalid" };

// Turns Google's record into the decision the app needs.
export function judgePlayPurchase(purchase: PlayProductPurchase): PlayVerdict {
  if (purchase.purchaseState === 1) return { ok: false, code: "revoked" };
  if (purchase.purchaseState === 2) return { ok: false, code: "pending" };
  if (purchase.purchaseState !== 0) return { ok: false, code: "invalid" };
  return { ok: true, environment: purchase.purchaseType === 0 ? "Test" : "Production" };
}

// Tokens of one-time purchases Google has voided (refunds, chargebacks) since
// `sinceMs`. Returns null when Google couldn't answer.
export async function listVoidedPurchaseTokens(
  accessToken: string,
  packageName: string,
  sinceMs: number,
  fetchFn: FetchFn = fetch
): Promise<string[] | null> {
  const tokens: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ startTime: String(sinceMs), type: "0", maxResults: "1000" });
    if (pageToken) params.set("token", pageToken);
    const res = await fetchFn(`${API}/${packageName}/purchases/voidedpurchases?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error(`Google voided-purchases lookup returned ${res.status}`);
      return null;
    }
    const body = (await res.json()) as {
      voidedPurchases?: { purchaseToken?: string }[];
      tokenPagination?: { nextPageToken?: string };
    };
    for (const v of body.voidedPurchases ?? []) if (v.purchaseToken) tokens.push(v.purchaseToken);
    pageToken = body.tokenPagination?.nextPageToken;
    if (!pageToken) break;
  }
  return tokens;
}
