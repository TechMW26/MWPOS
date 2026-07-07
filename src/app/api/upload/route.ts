import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { put } from "@vercel/blob";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const purpose = String(formData.get("purpose") || "product");
    if (!file) return NextResponse.json({ message: "No file provided" }, { status: 400 });

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
    const blob = await put(`${folder}/${Date.now()}-${file.name}`, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url, fileName: file.name, mimeType: file.type, size: file.size }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
