import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { put } from "@vercel/blob";
import sharp from "sharp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const purpose = String(formData.get("purpose") || "product");
    if (!file) return NextResponse.json({ message: "No file provided" }, { status: 400 });
    if (purpose !== "order-proof" && !["SUPERADMIN", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ message: "Only administrators can upload product images" }, { status: 403 });
    }

    const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const proofTypes = [
      ...imageTypes,
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedTypes = purpose === "order-proof" ? proofTypes : imageTypes;
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ message: purpose === "order-proof" ? "Invalid file type. Allowed: images, PDF, Word, Excel" : "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" }, { status: 400 });
    }

    const maxBytes = purpose === "order-proof" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ message: `File too large. Max ${purpose === "order-proof" ? "10MB" : "5MB"}` }, { status: 400 });
    }

    const folder = purpose === "order-proof" ? "order-proofs" : "products";
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
    let uploadBody: File | Buffer = file;
    let contentType = file.type;
    let uploadName = safeName;
    if (purpose !== "order-proof") {
      uploadBody = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      contentType = "image/webp";
      uploadName = safeName.replace(/\.[^.]+$/, "") + ".webp";
    }
    const blob = await put(`${folder}/${Date.now()}-${uploadName}`, uploadBody, {
      access: "private",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const mediaUrl = `/api/media/${blob.pathname.split("/").map(encodeURIComponent).join("/")}`;

    return NextResponse.json({ url: mediaUrl, pathname: blob.pathname, fileName: uploadName, mimeType: contentType, size: uploadBody instanceof File ? uploadBody.size : uploadBody.byteLength }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
