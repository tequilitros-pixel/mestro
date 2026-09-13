import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";
import { randomUUID } from "crypto";
import { validateUploadedFile } from "@/lib/uploads";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

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

  const blob = await put(`pos/products/${randomUUID()}.${validated.extension}`, validated.bytes, {
    access: "public",
    contentType: validated.contentType,
  });

  return NextResponse.json({ url: blob.url });
}
