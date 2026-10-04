// Keeps the login session in the device's secure store (iOS Keychain /
// Android Keystore) instead of plain app storage. Written against small
// interfaces so it can be tested without the native modules; the real ones are
// wired up in secureSessionStorage.ts.

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface PlainStoreLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// A session (access + refresh token + user) is larger than one secure-store
// value should be, so it is stored in pieces.
const CHUNK_SIZE = 1800;

export function createSecureSessionStorage(secure: SecureStoreLike, plain: PlainStoreLike) {
  // Secure-store keys may only contain letters, digits, ".", "-" and "_".
  const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");
  const countKey = (key: string) => `${safe(key)}.chunks`;
  const chunkKey = (key: string, i: number) => `${safe(key)}.${i}`;
  // iOS keeps Keychain items even after the app is deleted, but plain app
  // storage is wiped with it. This marker lives in plain storage, so a missing
  // marker means "fresh install": leftovers in the Keychain from a previous
  // install are discarded, and deleting the app still means starting over.
  const markerKey = (key: string) => `tanka:secure-ready:${safe(key)}`;

  const checked = new Set<string>();

  async function removeChunks(key: string): Promise<void> {
    const raw = await secure.getItemAsync(countKey(key)).catch(() => null);
    const count = raw ? Number(raw) : 0;
    for (let i = 0; i < (Number.isFinite(count) ? count : 0); i++) {
      await secure.deleteItemAsync(chunkKey(key, i)).catch(() => undefined);
    }
    await secure.deleteItemAsync(countKey(key)).catch(() => undefined);
  }

  async function ensureFreshInstallHandled(key: string): Promise<void> {
    if (checked.has(key)) return;
    const marker = await plain.getItem(markerKey(key)).catch(() => null);
    if (!marker) {
      await removeChunks(key);
      await plain.setItem(markerKey(key), "1").catch(() => undefined);
    }
    checked.add(key);
  }

  async function readSecure(key: string): Promise<string | null> {
    const raw = await secure.getItemAsync(countKey(key));
    if (!raw) return null;
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 1 || count > 100) return null;
    let value = "";
    for (let i = 0; i < count; i++) {
      const part = await secure.getItemAsync(chunkKey(key, i));
      if (part == null) return null; // incomplete -> treat as signed out, never half a session
      value += part;
    }
    return value;
  }

  async function writeSecure(key: string, value: string): Promise<void> {
    const oldRaw = await secure.getItemAsync(countKey(key)).catch(() => null);
    const oldCount = oldRaw ? Number(oldRaw) : 0;
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) parts.push(value.slice(i, i + CHUNK_SIZE));
    if (parts.length === 0) parts.push("");
    for (let i = 0; i < parts.length; i++) await secure.setItemAsync(chunkKey(key, i), parts[i]);
    // The count is written last, so a reader never sees a count whose pieces
    // aren't all there yet.
    await secure.setItemAsync(countKey(key), String(parts.length));
    for (let i = parts.length; i < (Number.isFinite(oldCount) ? oldCount : 0); i++) {
      await secure.deleteItemAsync(chunkKey(key, i)).catch(() => undefined);
    }
  }

  return {
    async getItem(key: string): Promise<string | null> {
      await ensureFreshInstallHandled(key);
      try {
        const value = await readSecure(key);
        if (value !== null) return value;
      } catch {
        // secure store unavailable -> fall through to plain storage below
      }
      // Sessions saved by earlier versions of the app (plain storage, or the
      // fallback path below): move them into the secure store, keep the user
      // signed in.
      const legacy = await plain.getItem(key);
      if (legacy) {
        try {
          await writeSecure(key, legacy);
          await plain.removeItem(key);
        } catch {
          // keep it in plain storage if the move fails
        }
      }
      return legacy;
    },

    async setItem(key: string, value: string): Promise<void> {
      await ensureFreshInstallHandled(key);
      try {
        await writeSecure(key, value);
        await plain.removeItem(key);
      } catch {
        // Never lose a session just because the secure store failed.
        await plain.setItem(key, value);
      }
    },

    async removeItem(key: string): Promise<void> {
      await ensureFreshInstallHandled(key);
      await removeChunks(key).catch(() => undefined);
      await plain.removeItem(key);
    },
  };
}
