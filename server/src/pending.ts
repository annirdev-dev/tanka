const pending = new Map<string, Promise<unknown>>();

// Coalesces concurrent requests for the same key into a single in-flight call,
// so duplicate requests arriving before the first resolves don't each redo
// the same work.
export function dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;

  const promise = factory().finally(() => {
    pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
}
