const INVALID_KEY_CHARACTERS = /[\/.#$\[\]]/;

function assertValidSegment(segment: string, path: string): void {
  if (!segment || INVALID_KEY_CHARACTERS.test(segment)) {
    throw new Error(`Invalid Firebase key at "${path}"`);
  }
}

function validateValue(value: unknown, path: string, seen: WeakSet<object>): void {
  if (value === undefined) throw new Error(`Undefined value at "${path}"`);
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`Non-finite number at "${path}"`);
  }
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) throw new Error(`Circular value at "${path}"`);
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateValue(entry, `${path}/${index}`, seen));
  } else {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertValidSegment(key, `${path}/${key}`);
      validateValue(entry, `${path}/${key}`, seen);
    }
  }
  seen.delete(value);
}

export function validateRtdbValue(value: unknown): void {
  validateValue(value, "$", new WeakSet());
}

export function validateRtdbUpdate(update: Record<string, unknown>): void {
  if (!update || Array.isArray(update) || typeof update !== "object") {
    throw new Error("Firebase update payload must be an object");
  }

  const normalizedPaths = Object.keys(update).map((path) => {
    const normalized = path.replace(/^\/+|\/+$/g, "");
    if (!normalized) throw new Error("Firebase update path cannot be empty");
    normalized.split("/").forEach((segment) => assertValidSegment(segment, normalized));
    return normalized;
  }).sort();

  for (let index = 1; index < normalizedPaths.length; index += 1) {
    const parent = normalizedPaths[index - 1]!;
    const child = normalizedPaths[index]!;
    if (child === parent || child.startsWith(`${parent}/`)) {
      throw new Error(`Overlapping Firebase update paths: "${parent}" and "${child}"`);
    }
  }

  for (const [path, value] of Object.entries(update)) {
    validateValue(value, `$/${path}`, new WeakSet());
  }
}
