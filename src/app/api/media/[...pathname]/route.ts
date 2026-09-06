import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ pathname: string[] }> }
) {
  const { pathname: segments } = await context.params;
  let decodedSegments: string[];
  try {
    decodedSegments = segments.map(decodeURIComponent);
  } catch {
    return NextResponse.json({ message: "Media not found" }, { status: 404 });
  }
  if (decodedSegments.some((segment) => !segment || segment === "." || segment === ".." || /[\\/]/.test(segment))) {
    return NextResponse.json({ message: "Media not found" }, { status: 404 });
  }
  const pathname = decodedSegments.join("/");
  const isProduct = pathname.startsWith("products/");
  const isOrderProof = pathname.startsWith("order-proofs/");
  if (!isProduct && !isOrderProof) return NextResponse.json({ message: "Media not found" }, { status: 404 });
  if (isOrderProof && !(await getSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const result = await get(pathname, {
    access: "private",
    useCache: true,
    ifNoneMatch: request.headers.get("if-none-match") || undefined,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!result) return NextResponse.json({ message: "Media not found" }, { status: 404 });
  if (result.statusCode === 304) {
    return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag } });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Length": String(result.blob.size),
      "Content-Disposition": "inline",
      ETag: result.blob.etag,
      "Cache-Control": isProduct
        ? "public, max-age=86400, s-maxage=31536000, immutable"
        : "private, no-store",
    },
  });
}
