import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  // 1. Strip surrounding quotes and trim whitespace
  let key = raw.replace(/^["']|["']$/g, "").trim();

  // 2. Convert escaped newlines to real ones (handles \\n, \\\\n, and literal \n)
  key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");

  // 3. Ensure PEM header/footer are properly separated with newlines.
  //    cert() needs newline-delimited 64-char lines, not a single-line blob.
  key = key.replace(/(-----BEGIN [A-Z ]+-----)\s*/g, "$1\n")
           .replace(/\s*(-----END [A-Z ]+-----)/g, "\n$1\n");

  // 4. If after all this the key is still a single line (no real newlines),
  //    line-wrap the base64 body at 64 chars so cert() can parse it.
  if (!key.includes("\n")) {
    return key;
  }

  const lines = key.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("-----")) {
      result.push(trimmed);
    } else if (trimmed.length > 64) {
      // Break long base64 lines into 64-char chunks
      for (let i = 0; i < trimmed.length; i += 64) {
        result.push(trimmed.slice(i, i + 64));
      }
    } else if (trimmed.length > 0) {
      result.push(trimmed);
    }
  }
  return result.join("\n") + "\n";
}

export function getFirebaseAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const privateKey = normalizePrivateKey(rawKey);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not configured");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminMessaging(): Messaging {
  return getMessaging(getFirebaseAdminApp());
}
