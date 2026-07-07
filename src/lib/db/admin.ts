type QueryParams = Record<string, string | number | boolean>;

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

  constructor(private readonly path: string) {}

  child(childPath: string): RtdbRef {
    return new RtdbRef(joinPath(this.path, childPath));
  }

  orderByChild(child: string): RtdbRef {
    const ref = new RtdbRef(this.path);
    ref.orderChild = child;
    ref.equalValue = this.equalValue;
    return ref;
  }

  equalTo(value: unknown): RtdbRef {
    const ref = new RtdbRef(this.path);
    ref.orderChild = this.orderChild;
    ref.equalValue = value;
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

    const response = await fetch(buildUrl(this.path, params), { cache: "no-store" });
    if (response.status === 400 && this.orderChild) {
      return this.getFilteredWithoutIndex();
    }

    if (!response.ok) {
      throw new Error(`RTDB read failed: ${response.status}`);
    }

    return new RtdbSnapshot(await response.json());
  }

  private async getFilteredWithoutIndex(): Promise<RtdbSnapshot> {
    const response = await fetch(buildUrl(this.path), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`RTDB read failed: ${response.status}`);
    }

    const collection = await response.json();
    if (!collection || typeof collection !== "object" || !this.orderChild) {
      return new RtdbSnapshot(null);
    }

    if (this.equalValue === undefined) {
      return new RtdbSnapshot(collection);
    }

    const filtered = Object.fromEntries(
      Object.entries(collection as Record<string, Record<string, unknown>>).filter(
        ([, value]) => value?.[this.orderChild!] === this.equalValue
      )
    );

    return new RtdbSnapshot(Object.keys(filtered).length > 0 ? filtered : null);
  }

  async set(value: unknown): Promise<void> {
    const response = await fetch(buildUrl(this.path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!response.ok) {
      throw new Error(`RTDB write failed: ${response.status}`);
    }
  }

  async update(value: Record<string, unknown>): Promise<void> {
    let body: string;
    try {
      body = JSON.stringify(value);
    } catch (e) {
      throw new Error(`RTDB update failed: cannot serialize data — ${e instanceof Error ? e.message : String(e)}`);
    }
    const response = await fetch(buildUrl(this.path), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`RTDB update failed: ${response.status}${details ? ` ${details}` : ""}`);
    }
  }

  async remove(): Promise<void> {
    await this.set(null);
  }

  async transaction<T>(
    updater: (current: any) => T | null | undefined
  ): Promise<{ committed: boolean; snapshot: RtdbSnapshot }> {
    const snapshot = await this.get();
    const nextValue = updater(snapshot.exists() ? (snapshot.val() as T) : null);

    if (nextValue === undefined) {
      return { committed: false, snapshot };
    }

    await this.set(nextValue);
    return { committed: true, snapshot: new RtdbSnapshot(nextValue) };
  }
}

function buildUrl(path: string, params: QueryParams = {}): string {
  const databaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_DATABASE_URL");
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
