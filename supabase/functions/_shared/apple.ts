import * as x509 from "npm:@peculiar/x509@1";
import { compactVerify, decodeProtectedHeader, importX509 } from "npm:jose@5";

// SHA-256 fingerprint of "Apple Root CA - G3", the root every App Store
// signed message chains up to. Published by Apple at
// https://support.apple.com/en-us/105116 (list of available root certificates).
export const APPLE_ROOT_G3_SHA256 =
  "63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179";

// Marker extensions that only Apple's App Store signing certificates carry:
//   leaf         1.2.840.113635.100.6.11.1  (App Store receipt signing)
//   intermediate 1.2.840.113635.100.6.2.1   (WWDR intermediate)
// Without this check a certificate from any Apple developer account — which
// also chains up to Apple Root CA - G3 — could sign a believable-looking
// message.
const LEAF_MARKER_OID = "1.2.840.113635.100.6.11.1";
const INTERMEDIATE_MARKER_OID = "1.2.840.113635.100.6.2.1";

export interface VerifyOptions {
  // Root certificate fingerprints we trust (uppercase hex, no colons).
  trustedRootSha256?: string[];
  // Turn off the Apple marker check (only for tests that build their own chain).
  requireAppleMarkers?: boolean;
  now?: Date;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// Verifies a JWS that Apple signed (App Store Server Notifications, signed
// transactions): the certificate chain in the header must be exactly
// leaf → intermediate → Apple's root, each signed by the next, all currently
// valid, the root must be the pinned one, the leaf/intermediate must carry
// Apple's App Store markers, and the signature must verify with the leaf's
// key. Returns the decoded payload; throws on anything unexpected.
//
// Uses only WebCrypto-based parsing (no node:crypto X509Certificate): the
// Supabase edge runtime doesn't implement all of that class's properties.
export async function verifyAppleJws(
  jws: string,
  options: VerifyOptions = {}
): Promise<Record<string, unknown>> {
  const trusted = options.trustedRootSha256 ?? [APPLE_ROOT_G3_SHA256];
  const requireMarkers = options.requireAppleMarkers ?? true;
  const now = options.now ?? new Date();

  const header = decodeProtectedHeader(jws);
  if (header.alg !== "ES256") throw new Error("Unexpected signing algorithm");
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length !== 3) throw new Error("Unexpected certificate chain");

  const [leaf, intermediate, root] = x5c.map((b64) => new x509.X509Certificate(b64));

  const rootFingerprint = hex(await root.getThumbprint("SHA-256"));
  if (!trusted.includes(rootFingerprint)) throw new Error("Untrusted root certificate");

  if (leaf.issuer !== intermediate.subject || intermediate.issuer !== root.subject) {
    throw new Error("Certificate chain does not link up");
  }
  if (!(await root.verify({ publicKey: root.publicKey, signatureOnly: true }))) {
    throw new Error("Root certificate is not self-signed");
  }
  if (!(await intermediate.verify({ publicKey: root.publicKey, signatureOnly: true }))) {
    throw new Error("Intermediate not signed by root");
  }
  if (!(await leaf.verify({ publicKey: intermediate.publicKey, signatureOnly: true }))) {
    throw new Error("Leaf not signed by intermediate");
  }

  for (const cert of [leaf, intermediate, root]) {
    if (now < cert.notBefore || now > cert.notAfter) {
      throw new Error("Certificate outside its validity period");
    }
  }

  if (requireMarkers) {
    if (!leaf.getExtension(LEAF_MARKER_OID) || !intermediate.getExtension(INTERMEDIATE_MARKER_OID)) {
      throw new Error("Not an App Store signing certificate");
    }
  }

  const key = await importX509(leaf.toString("pem"), "ES256");
  const { payload } = await compactVerify(jws, key);
  return JSON.parse(new TextDecoder().decode(payload));
}
