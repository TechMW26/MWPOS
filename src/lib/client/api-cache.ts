type CacheEntry = { value: unknown; expiresAt: number };

const responseCache = new Map<string, CacheEntry>();
const requestsInFlight = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 100;

function cacheResponse(url: string, value: unknown, ttlMs: number): void {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
  if (!responseCache.has(url) && responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.delete(url);
  responseCache.set(url, { value, expiresAt: now + ttlMs });
}

export async function getJson<T>(url: string, options: { ttlMs?: number; force?: boolean } = {}): Promise<T> {
  const ttlMs = options.ttlMs ?? 15_000;
  const cached = responseCache.get(url);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.value as T;

  const existing = requestsInFlight.get(url);
  if (existing) return existing as Promise<T>;

  const request = fetch(url, { credentials: "same-origin" }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message || `Request failed (${response.status})`);
    }
    cacheResponse(url, payload, ttlMs);
    return payload as T;
  }).finally(() => {
    requestsInFlight.delete(url);
  });

  requestsInFlight.set(url, request);
  return request;
}

export function invalidateJson(prefix?: string): void {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) responseCache.delete(key);
  }
}
