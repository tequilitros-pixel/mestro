import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";
import { randomUUID } from "crypto";
import { validateUploadedFile } from "@/lib/uploads";
import sharp from "sharp";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1200;
const IMAGE_QUALITY = 82;

export async function POST(req: NextRequest) {
  await requireAdmin();

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  const validated = await validateUploadedFile(file, {
    maxBytes: MAX_SIZE_BYTES,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (!validated) {
    return NextResponse.json(
      { error: "Usa una imagen JPG, PNG o WebP válida de máximo 5 MB." },
      { status: 400 }
    );
  }

  let compressed: Buffer;
  try {
    compressed = await sharp(Buffer.from(validated.bytes), { failOn: "error" })
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_QUALITY, effort: 4 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "No se pudo procesar la imagen. Prueba con otro archivo." },
      { status: 400 },
    );
  }

  const blob = await put(`pos/products/${randomUUID()}.webp`, compressed, {
    access: "public",
    contentType: "image/webp",
  });

  return NextResponse.json({
    url: blob.url,
    contentType: "image/webp",
    originalBytes: file.size,
    storedBytes: compressed.byteLength,
  });
}
