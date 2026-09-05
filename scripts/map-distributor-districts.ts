import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { v4 as uuidv4 } from "uuid";
import { adminDb } from "../src/lib/db/admin";
import { INDIAN_STATES_DISTRICTS } from "../src/lib/indian-districts";
import type { District, Store, User } from "../src/types/models";

type ResolutionSource = "PINCODE" | "ADDRESS" | "POST_OFFICE" | "REGION_FALLBACK";

interface Resolution {
  state: string;
  district: string;
  source: ResolutionSource;
}

interface PostalOffice {
  Name?: string;
  District?: string;
  State?: string;
}

interface PostalResponse {
  Status?: string;
  PostOffice?: PostalOffice[] | null;
}

interface LocationAlias {
  terms: RegExp;
  state: string;
  district: string;
}

const cachePath = "/tmp/mwpos-postal-district-cache.json";
const apply = process.argv.includes("--apply");
const postalCache: Record<string, Resolution | null> = existsSync(cachePath)
  ? JSON.parse(readFileSync(cachePath, "utf8"))
  : {};

const DISTRICT_ALIASES: Record<string, Record<string, string>> = {
  "Madhya Pradesh": {
    HOSHANGABAD: "Narmadapuram",
    EASTNIMAR: "Khandwa",
    WESTNIMAR: "Khargone",
  },
  "Uttar Pradesh": {
    ALLAHABAD: "Prayagraj",
  },
};

const LOCATION_ALIASES: LocationAlias[] = [
  { terms: /\b(ROHTAK)\b/i, state: "Haryana", district: "Rohtak" },
  { terms: /\b(BALAGATH)\b/i, state: "Madhya Pradesh", district: "Balaghat" },
  { terms: /\b(MANDSOUR)\b/i, state: "Madhya Pradesh", district: "Mandsaur" },
  { terms: /\b(SHAHJAHPUR|SHAHJAPUR|SHAHJAHAPUR|SHAHJAHANPUR)\b/i, state: "Madhya Pradesh", district: "Shajapur" },
  { terms: /\b(ALLAHABAD|PRAYAGRAJ|SHANKARGARH)\b/i, state: "Uttar Pradesh", district: "Prayagraj" },
  { terms: /\b(MAURANIPUR)\b/i, state: "Uttar Pradesh", district: "Jhansi" },
  { terms: /\b(ATARRA)\b/i, state: "Uttar Pradesh", district: "Banda" },
  { terms: /\b(RATH)\b/i, state: "Uttar Pradesh", district: "Hamirpur" },
  { terms: /\b(ORAI|KONCH)\b/i, state: "Uttar Pradesh", district: "Jalaun" },
  { terms: /\b(AMARKANTAK|KOTMA|JAITHARI)\b/i, state: "Madhya Pradesh", district: "Anuppur" },
  { terms: /\b(ASHTA)\b/i, state: "Madhya Pradesh", district: "Sehore" },
  { terms: /\b(AMANGANJ|AJAIGARH|PAWAI)\b/i, state: "Madhya Pradesh", district: "Panna" },
  { terms: /\b(PACHOR|PACHORE|BIORA|JIRAPUR|JEERAPUR|KHUJNER|KHILCHIPUR)\b/i, state: "Madhya Pradesh", district: "Rajgarh" },
  { terms: /\b(PIPARIYA|BABAI|HOSHANGABAD|ITARSI|SOHAGPUR)\b/i, state: "Madhya Pradesh", district: "Narmadapuram" },
  { terms: /\b(BURHAR|BEOHARI|JAISINGHNAGAR)\b/i, state: "Madhya Pradesh", district: "Shahdol" },
  { terms: /\b(WAIDHAN|WADHAIN|DEOSAR|CHITRANGI|GANIYARI)\b/i, state: "Madhya Pradesh", district: "Singrauli" },
  { terms: /\b(KARELI|GADARWARA|GOTEGAON)\b/i, state: "Madhya Pradesh", district: "Narsinghpur" },
  { terms: /\b(NAINPUR)\b/i, state: "Madhya Pradesh", district: "Mandla" },
  { terms: /\b(BERASIA|BERASIYA)\b/i, state: "Madhya Pradesh", district: "Bhopal" },
  { terms: /\b(SHUJALPUR|KALAPIPAL)\b/i, state: "Madhya Pradesh", district: "Shajapur" },
  { terms: /\b(ZIRNIYA|JHIRANYA|BHIKANGAON|KHARGON)\b/i, state: "Madhya Pradesh", district: "Khargone" },
  { terms: /\b(PITHAMPUR|MANAWAR)\b/i, state: "Madhya Pradesh", district: "Dhar" },
  { terms: /\b(MULTAI|AMLA)\b/i, state: "Madhya Pradesh", district: "Betul" },
  { terms: /\b(MANDIDEEP|OBEDULLAGANJ)\b/i, state: "Madhya Pradesh", district: "Raisen" },
  { terms: /\b(CHANDERI)\b/i, state: "Madhya Pradesh", district: "Ashoknagar" },
  { terms: /\b(DABRA|BHITARWAR)\b/i, state: "Madhya Pradesh", district: "Gwalior" },
  { terms: /\b(AMBAH|PORSA)\b/i, state: "Madhya Pradesh", district: "Morena" },
  { terms: /\b(LAHAR|GOHAD)\b/i, state: "Madhya Pradesh", district: "Bhind" },
  { terms: /\b(MHOW)\b/i, state: "Madhya Pradesh", district: "Indore" },
  { terms: /\b(KANNOD)\b/i, state: "Madhya Pradesh", district: "Dewas" },
  { terms: /\b(SAUSAR|PANDHURNA)\b/i, state: "Madhya Pradesh", district: "Pandhurna" },
  { terms: /\b(CHINDWADA|CHHINDWARA)\b/i, state: "Madhya Pradesh", district: "Chhindwara" },
];

const REGION_FALLBACKS: Array<{ marker: string; state: string; district: string }> = [
  { marker: "Jabalpur Region", state: "Madhya Pradesh", district: "Jabalpur" },
  { marker: "Bhopal, Indore & Gwalior Region", state: "Madhya Pradesh", district: "Bhopal" },
  { marker: "Uttar Pradesh Region", state: "Uttar Pradesh", district: "Lucknow" },
];

const CANDIDATE_STOP_WORDS = new Set([
  "ROAD", "WARD", "SHOP", "NUMBER", "NO", "NEAR", "OPP", "OPPOSITE", "FLOOR", "MARKET", "BAZAR", "COLONY",
  "NAGAR", "MARG", "CHOWK", "COMPLEX", "MAIN", "NEW", "OLD", "THE", "AND", "MP", "UP", "INDIA", "REGION",
]);

function normalized(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function canonicalState(raw: string): string | null {
  const key = normalized(raw);
  return Object.keys(INDIAN_STATES_DISTRICTS).find((state) => normalized(state) === key) ?? null;
}

function canonicalDistrict(state: string, raw: string): string | null {
  const key = normalized(raw);
  const alias = DISTRICT_ALIASES[state]?.[key];
  if (alias) return alias;
  return INDIAN_STATES_DISTRICTS[state]?.find((district) => normalized(district) === key) ?? null;
}

function mostFrequent(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function resolutionFromOffices(offices: PostalOffice[], expectedState?: string): Resolution | null {
  const usable = offices
    .map((office) => {
      const state = office.State ? canonicalState(office.State) : null;
      const district = state && office.District ? canonicalDistrict(state, office.District) : null;
      return state && district ? { state, district } : null;
    })
    .filter((entry): entry is { state: string; district: string } => Boolean(entry));
  const stateMatched = expectedState ? usable.filter((entry) => entry.state === expectedState) : usable;
  const candidates = stateMatched.length ? stateMatched : usable;
  const state = mostFrequent(candidates.map((entry) => entry.state));
  if (!state) return null;
  const district = mostFrequent(candidates.filter((entry) => entry.state === state).map((entry) => entry.district));
  return district ? { state, district, source: "PINCODE" } : null;
}

async function postalRequest(path: string): Promise<PostalResponse[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`https://api.postalpincode.in/${path}`, {
        headers: { "User-Agent": "MWPOS district mapper/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Postal lookup returned ${response.status}`);
      return await response.json() as PostalResponse[];
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function resolvePincode(pincode: string, expectedState: string): Promise<Resolution | null> {
  const key = `pin:${pincode}`;
  if (key in postalCache) return postalCache[key] ?? null;
  const payload = await postalRequest(`pincode/${encodeURIComponent(pincode)}`);
  const offices = payload.flatMap((entry) => entry.Status === "Success" ? entry.PostOffice ?? [] : []);
  const resolution = resolutionFromOffices(offices, expectedState);
  postalCache[key] = resolution;
  return resolution;
}

function directAddressResolution(store: Store): Resolution | null {
  const haystack = `${store.city ?? ""} ${store.address ?? ""}`;
  for (const alias of LOCATION_ALIASES) {
    if (alias.terms.test(haystack)) return { state: alias.state, district: alias.district, source: "ADDRESS" };
  }

  const currentState = canonicalState(store.state) ?? store.state;
  const stateDistricts = INDIAN_STATES_DISTRICTS[currentState] ?? [];
  const match = [...stateDistricts]
    .sort((left, right) => right.length - left.length)
    .find((district) => new RegExp(`\\b${district.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[ -]+/g, "[ -]+")}\\b`, "i").test(haystack));
  return match ? { state: currentState, district: match, source: "ADDRESS" } : null;
}

function postOfficeCandidates(store: Store): string[] {
  const candidates: string[] = [];
  for (const value of [store.city, store.address]) {
    const tokens = String(value ?? "").toUpperCase().match(/[A-Z]{3,}/g) ?? [];
    const useful = tokens.filter((token) => !CANDIDATE_STOP_WORDS.has(token));
    for (const size of [1, 2]) {
      if (useful.length >= size) candidates.push(useful.slice(-size).join(" "));
    }
  }
  return [...new Set(candidates)].filter((candidate) => candidate.length >= 3).slice(0, 4);
}

async function resolvePostOffice(store: Store, expectedState: string): Promise<Resolution | null> {
  for (const candidate of postOfficeCandidates(store)) {
    const key = `office:${normalized(expectedState)}:${normalized(candidate)}`;
    let resolution = postalCache[key];
    if (!(key in postalCache)) {
      const payload = await postalRequest(`postoffice/${encodeURIComponent(candidate)}`);
      const offices = payload.flatMap((entry) => entry.Status === "Success" ? entry.PostOffice ?? [] : []);
      resolution = resolutionFromOffices(offices, expectedState);
      if (resolution) resolution.source = "POST_OFFICE";
      postalCache[key] = resolution ?? null;
    }
    if (resolution) return resolution;
  }
  return null;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return output;
}

async function resolveStore(store: Store): Promise<{ store: Store; resolution: Resolution }> {
  const expectedState = canonicalState(store.state) ?? store.state;
  const pincode = String(store.pincode ?? "").match(/\b[1-9]\d{5}\b/)?.[0];
  let resolution = pincode ? await resolvePincode(pincode, expectedState) : null;
  resolution ??= directAddressResolution(store);
  resolution ??= await resolvePostOffice(store, expectedState);
  if (!resolution) {
    const fallback = REGION_FALLBACKS.find((candidate) => store.city === candidate.marker);
    resolution = fallback
      ? { state: fallback.state, district: fallback.district, source: "REGION_FALLBACK" }
      : { state: expectedState, district: expectedState === "Uttar Pradesh" ? "Lucknow" : "Bhopal", source: "REGION_FALLBACK" };
  }
  return { store, resolution };
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const [storesSnapshot, usersSnapshot, districtsSnapshot] = await Promise.all([
    adminDb.ref("stores").get(),
    adminDb.ref("users").get(),
    adminDb.ref("districts").get(),
  ]);
  const stores = Object.values((storesSnapshot.val() ?? {}) as Record<string, Store>)
    .filter((store) => store.type === "DISTRIBUTOR");
  const users = Object.values((usersSnapshot.val() ?? {}) as Record<string, User>);
  const superadmin = users.find((user) => user.role === "SUPERADMIN" && user.isActive);
  if (!superadmin) throw new Error("An active superadmin is required to attribute district mapping changes");

  const resolved = await mapWithConcurrency(stores, 8, resolveStore);
  writeFileSync(cachePath, JSON.stringify(postalCache, null, 2));
  const sourceCounts = resolved.reduce<Record<string, number>>((counts, item) => {
    counts[item.resolution.source] = (counts[item.resolution.source] ?? 0) + 1;
    return counts;
  }, {});
  const districtCounts = resolved.reduce<Record<string, number>>((counts, item) => {
    const key = `${item.resolution.state}|${item.resolution.district}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const changed = resolved.filter(({ store, resolution }) =>
    store.districtId !== `${resolution.state}|${resolution.district}` || store.state !== resolution.state
  );

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    distributors: stores.length,
    mapped: resolved.length,
    changed: changed.length,
    sourceCounts,
    districts: Object.keys(districtCounts).length,
    districtCounts,
    reviewRequired: resolved
      .filter((item) => item.resolution.source === "REGION_FALLBACK")
      .map(({ store, resolution }) => ({
        id: store.id,
        name: store.name,
        address: store.address,
        city: store.city,
        currentState: store.state,
        proposedDistrict: `${resolution.state}|${resolution.district}`,
      })),
  }, null, 2));
  if (!apply) return;

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};
  for (const { store, resolution } of changed) {
    const districtId = `${resolution.state}|${resolution.district}`;
    updates[`stores/${store.id}/districtId`] = districtId;
    updates[`stores/${store.id}/state`] = resolution.state;
    updates[`stores/${store.id}/updatedAt`] = now;
    updates[`distributors/${store.id}/districtId`] = districtId;
    updates[`distributors/${store.id}/state`] = resolution.state;
    updates[`distributors/${store.id}/updatedAt`] = now;
    const auditId = uuidv4();
    updates[`auditLogs/${auditId}`] = {
      id: auditId,
      actorId: superadmin.uid,
      action: "STORE_UPDATED",
      entityType: "STORE",
      entityId: store.id,
      before: { districtId: store.districtId ?? null, state: store.state },
      after: { districtId, state: resolution.state, locationSource: resolution.source },
      ipAddress: null,
      createdAt: now,
    };
  }

  const existingDistricts = Object.values((districtsSnapshot.val() ?? {}) as Record<string, District>);
  for (const location of Object.keys(districtCounts)) {
    const [state, districtName] = location.split("|") as [string, string];
    const exists = existingDistricts.some((district) =>
      normalized(district.state) === normalized(state) && normalized(district.name) === normalized(districtName)
    );
    if (exists) continue;
    const id = uuidv4();
    const district: District = {
      id,
      name: districtName,
      city: districtName,
      state,
      isActive: true,
      createdBy: superadmin.uid,
      createdAt: now,
      updatedAt: now,
    };
    updates[`districts/${id}`] = district;
  }

  await adminDb.ref().update(updates);
  console.log(JSON.stringify({ applied: true, updatedStores: changed.length, configuredDistricts: Object.keys(districtCounts).length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
