import { loadEnvConfig } from "@next/env";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { adminDb } from "../src/lib/db/admin";
import type { Product, User } from "../src/types/models";

type InlineImage = Product & { imageUrl: string };

function decodeDataUrl(value: string): { mimeType: string; bytes: Buffer } {
  const match = value.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("Unsupported inline image format");
  return { mimeType: match[1]!, bytes: Buffer.from(match[2]!.replace(/\s/g, ""), "base64") };
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const apply = process.argv.includes("--apply");
  const [productsSnapshot, usersSnapshot] = await Promise.all([
    adminDb.ref("products").get(),
    adminDb.ref("users").orderByChild("role").equalTo("SUPERADMIN").get(),
  ]);
  const products = Object.values((productsSnapshot.val() as Record<string, Product> | null) ?? {});
  const inline = products.filter((product): product is InlineImage =>
    typeof product.imageUrl === "string" && product.imageUrl.startsWith("data:image/")
  );
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    products: products.length,
    inlineImages: inline.length,
    inlineCharacters: inline.reduce((total, product) => total + product.imageUrl.length, 0),
  }, null, 2));
  if (!apply || !inline.length) return;

  const superadmin = Object.values((usersSnapshot.val() as Record<string, User> | null) ?? {})
    .find((user) => user.isActive);
  if (!superadmin) throw new Error("An active superadmin is required to attribute this migration");

  for (const product of inline) {
    const original = decodeDataUrl(product.imageUrl);
    const optimized = await sharp(original.bytes)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    const blob = await put(`products/${product.id}-optimized.webp`, optimized, {
      access: "private",
      contentType: "image/webp",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const mediaUrl = `/api/media/${blob.pathname.split("/").map(encodeURIComponent).join("/")}`;
    const now = new Date().toISOString();
    const auditId = uuidv4();
    await adminDb.ref().update({
      [`products/${product.id}/imageUrl`]: mediaUrl,
      [`products/${product.id}/updatedAt`]: now,
      [`auditLogs/${auditId}`]: {
        id: auditId,
        actorId: superadmin.uid,
        action: "PRODUCT_UPDATED",
        entityType: "PRODUCT",
        entityId: product.id,
        before: { imageStorage: "RTDB_INLINE", bytes: original.bytes.byteLength },
        after: { imageStorage: "VERCEL_BLOB", bytes: optimized.byteLength },
        ipAddress: null,
        createdAt: now,
      },
    });
    console.log(JSON.stringify({
      productId: product.id,
      originalBytes: original.bytes.byteLength,
      optimizedBytes: optimized.byteLength,
      reductionPercent: Math.round((1 - optimized.byteLength / original.bytes.byteLength) * 100),
    }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
