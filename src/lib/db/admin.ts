import { getFirebaseAdminApp } from "@/lib/firebase/admin-auth";
import { validateRtdbUpdate, validateRtdbValue } from "@/lib/db/rtdb-validation";

type QueryParams = Record<string, string | number | boolean>;

let accessTokenCache: { token: string; expiresAt: number } | null = null;
let accessTokenPromise: Promise<{ token: string; expiresAt: number }> | null = null;

async function databaseHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) return extra;
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return { ...extra, Authorization: `Bearer ${accessTokenCache.token}` };
  }

  if (!accessTokenPromise) {
    accessTokenPromise = (async () => {
      const credential = getFirebaseAdminApp().options.credential;
      if (!credential) throw new Error("Firebase Admin credentials are not configured for database access");
      const accessToken = await credential.getAccessToken();
      return {
        token: accessToken.access_token,
        expiresAt: Date.now() + accessToken.expires_in * 1000,
      };
    })().finally(() => { accessTokenPromise = null; });
  }
  accessTokenCache = await accessTokenPromise;
  return { ...extra, Authorization: `Bearer ${accessTokenCache.token}` };
}

// ─── Simple in-memory read cache (TTL: 3 seconds) ───────────
const readCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 3000;
const MAX_CACHE_ENTRIES = 250;

function cacheKey(path: string, params: QueryParams): string {
  const qs = Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join("&");
  return qs ? `${path}?${qs}` : path;
}

function getCached(key: string): unknown | undefined {
  const entry = readCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  readCache.delete(key);
  return undefined;
}

function setCache(key: string, data: unknown): void {
  const now = Date.now();
  for (const [cachedKey, entry] of readCache) {
    if (now - entry.ts >= CACHE_TTL_MS) readCache.delete(cachedKey);
  }
  if (!readCache.has(key) && readCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = readCache.keys().next().value as string | undefined;
    if (oldestKey) readCache.delete(oldestKey);
  }
  readCache.delete(key);
  readCache.set(key, { data, ts: now });
}

function compareQueryValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "string" && typeof right === "string") return left.localeCompare(right);
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return String(left ?? "").localeCompare(String(right ?? ""));
}

// A write changes the target, its descendants, and every cached ancestor.
function invalidateCache(path: string): void {
  const normalizedPath = path.replace(/^\/|\/$/g, "");
  if (!normalizedPath) {
    readCache.clear();
    return;
  }
  for (const key of readCache.keys()) {
    const keyPath = key.split("?")[0] ?? "";
    if (
      keyPath === normalizedPath
      || keyPath.startsWith(normalizedPath + "/")
      || normalizedPath.startsWith(keyPath + "/")
    ) {
      readCache.delete(key);
    }
  }
}

class RtdbSnapshot {
  constructor(private readonly data: unknown) {}

  exists(): boolean {
    return this.data !== null && this.data !== undefined;
  }

  val(): any {
    return this.data;
  }
}

class RtdbRef {
  private orderChild?: string;
  private equalValue?: unknown;
  private startValue?: unknown;
  private limitLast?: number;

  constructor(private readonly path: string) {}

  child(childPath: string): RtdbRef {
    return new RtdbRef(joinPath(this.path, childPath));
  }

  orderByChild(child: string): RtdbRef {
    const ref = new RtdbRef(this.path);
    ref.orderChild = child;
    ref.equalValue = this.equalValue;
    ref.startValue = this.startValue;
    ref.limitLast = this.limitLast;
    return ref;
  }

  equalTo(value: unknown): RtdbRef {
    const ref = new RtdbRef(this.path);
    ref.orderChild = this.orderChild;
    ref.equalValue = value;
    ref.startValue = this.startValue;
    ref.limitLast = this.limitLast;
    return ref;
  }

  startAt(value: unknown): RtdbRef {
    const ref = new RtdbRef(this.path);
    ref.orderChild = this.orderChild;
    ref.equalValue = this.equalValue;
    ref.startValue = value;
    ref.limitLast = this.limitLast;
    return ref;
  }

  limitToLast(limit: number): RtdbRef {
    const ref = new RtdbRef(this.path);
    ref.orderChild = this.orderChild;
    ref.equalValue = this.equalValue;
    ref.startValue = this.startValue;
    ref.limitLast = Math.max(1, Math.floor(limit));
    return ref;
  }

  async get(): Promise<RtdbSnapshot> {
    return this.once("value");
  }

  async once(eventType: "value"): Promise<RtdbSnapshot> {
    if (eventType !== "value") {
      throw new Error("Only value reads are supported by the RTDB REST adapter.");
    }

    const params: QueryParams = {};
    if (this.orderChild) params.orderBy = JSON.stringify(this.orderChild);
    if (this.equalValue !== undefined) params.equalTo = JSON.stringify(this.equalValue);
    if (this.startValue !== undefined) params.startAt = JSON.stringify(this.startValue);
    if (this.limitLast !== undefined) params.limitToLast = this.limitLast;

    const key = cacheKey(this.path, params);
    const cached = getCached(key);
    if (cached !== undefined) return new RtdbSnapshot(cached);

    const response = await fetch(buildUrl(this.path, params), { headers: await databaseHeaders() });
    if (response.status === 400 && this.orderChild) {
      return this.getFilteredWithoutIndex();
    }

    if (!response.ok) {
      throw new Error(`RTDB read failed: ${response.status}`);
    }

    const data = await response.json();
    setCache(key, data);
    return new RtdbSnapshot(data);
  }

  private async getFilteredWithoutIndex(): Promise<RtdbSnapshot> {
    const key = cacheKey(this.path, {});
    const cached = getCached(key);
    const collection: Record<string, Record<string, unknown>> = cached !== undefined
      ? cached as Record<string, Record<string, unknown>>
      : await (async () => {
          const response = await fetch(buildUrl(this.path), { headers: await databaseHeaders() });
          if (!response.ok) throw new Error(`RTDB read failed: ${response.status}`);
          const data = await response.json();
          setCache(key, data);
          return data;
        })();

    if (!collection || typeof collection !== "object" || !this.orderChild) {
      return new RtdbSnapshot(null);
    }

    if (this.equalValue === undefined && this.startValue === undefined && this.limitLast === undefined) {
      return new RtdbSnapshot(collection);
    }

    let entries = Object.entries(collection);
    if (this.equalValue !== undefined) {
      entries = entries.filter(([, value]) => value?.[this.orderChild!] === this.equalValue);
    }
    if (this.startValue !== undefined) {
      entries = entries.filter(([, value]) => {
        const childValue = value?.[this.orderChild!];
        return typeof childValue === typeof this.startValue && compareQueryValues(childValue, this.startValue) >= 0;
      });
    }
    entries.sort(([, left], [, right]) => {
      const leftValue = left?.[this.orderChild!];
      const rightValue = right?.[this.orderChild!];
      return compareQueryValues(leftValue, rightValue);
    });
    if (this.limitLast !== undefined) entries = entries.slice(-this.limitLast);
    const filtered = Object.fromEntries(entries);

    return new RtdbSnapshot(Object.keys(filtered).length > 0 ? filtered : null);
  }

  async set(value: unknown): Promise<void> {
    validateRtdbValue(value);
    const response = await fetch(buildUrl(this.path), {
      method: "PUT",
      headers: await databaseHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(value),
    });
    if (!response.ok) {
      throw new Error(`RTDB write failed: ${response.status}`);
    }
    invalidateCache(this.path);
  }

  async update(value: Record<string, unknown>): Promise<void> {
    let body: string;
    try {
      validateRtdbUpdate(value);
      body = JSON.stringify(value);
    } catch (e) {
      throw new Error(`RTDB update failed: cannot serialize data — ${e instanceof Error ? e.message : String(e)}`);
    }
    const response = await fetch(buildUrl(this.path), {
      method: "PATCH",
      headers: await databaseHeaders({ "Content-Type": "application/json" }),
      body,
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`RTDB update failed: ${response.status}${details ? ` ${details}` : ""}`);
    }
    invalidateCache(this.path);
  }

  async remove(): Promise<void> {
    await this.set(null);
  }

  async transaction<T>(
    updater: (current: any) => T | null | undefined
  ): Promise<{ committed: boolean; snapshot: RtdbSnapshot }> {
    const url = buildUrl(this.path);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const readResponse = await fetch(url, { headers: await databaseHeaders({ "X-Firebase-ETag": "true" }) });
      if (!readResponse.ok) throw new Error(`RTDB transaction read failed: ${readResponse.status}`);
      const current = await readResponse.json();
      const snapshot = new RtdbSnapshot(current);
      const nextValue = updater(snapshot.exists() ? (current as T) : null);
      if (nextValue === undefined) return { committed: false, snapshot };
      validateRtdbValue(nextValue);

      const etag = readResponse.headers.get("etag");
      if (!etag) throw new Error("RTDB transaction failed: missing ETag");
      const writeResponse = await fetch(url, {
        method: "PUT",
        headers: await databaseHeaders({ "Content-Type": "application/json", "If-Match": etag }),
        body: JSON.stringify(nextValue),
      });
      if (writeResponse.status === 412) continue;
      if (!writeResponse.ok) throw new Error(`RTDB transaction write failed: ${writeResponse.status}`);
      invalidateCache(this.path);
      return { committed: true, snapshot: new RtdbSnapshot(nextValue) };
    }
    throw new Error("RTDB transaction failed after concurrent updates");
  }
}

function buildUrl(path: string, params: QueryParams = {}): string {
  // Prefer a server-only runtime value. NEXT_PUBLIC_* variables are compiled
  // into Next.js bundles and cannot be safely overridden for isolated tests or
  // alternate server environments after the build has been produced.
  const databaseUrl = process.env.FIREBASE_DATABASE_URL ?? process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing FIREBASE_DATABASE_URL or NEXT_PUBLIC_FIREBASE_DATABASE_URL");
  }

  const cleanBase = databaseUrl.replace(/\/$/, "");
  const cleanPath = path.replace(/^\/|\/$/g, "");
  const url = new URL(`${cleanBase}/${cleanPath}.json`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function joinPath(basePath: string, childPath: string): string {
  return [basePath, childPath]
    .filter(Boolean)
    .map((part) => part.replace(/^\/|\/$/g, ""))
    .filter(Boolean)
    .join("/");
}

export const adminDb = {
  ref(path = ""): RtdbRef {
    return new RtdbRef(path);
  },
};

export const adminApp = null;
