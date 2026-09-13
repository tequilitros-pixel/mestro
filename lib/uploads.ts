import "server-only";

const SIGNATURES = {
  "image/jpeg": (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b: Uint8Array) => textAt(b, 0, 4) === "RIFF" && textAt(b, 8, 4) === "WEBP",
  "application/pdf": (b: Uint8Array) => textAt(b, 0, 5) === "%PDF-",
} as const;

const EXTENSIONS: Record<keyof typeof SIGNATURES, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function textAt(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

export async function validateUploadedFile(
  file: File,
  options: { maxBytes: number; allowedTypes: Array<keyof typeof SIGNATURES> },
) {
  if (file.size === 0 || file.size > options.maxBytes) return null;
  if (!options.allowedTypes.includes(file.type as keyof typeof SIGNATURES)) return null;

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const contentType = file.type as keyof typeof SIGNATURES;
  if (!SIGNATURES[contentType](bytes)) return null;
  return { bytes: buffer, contentType, extension: EXTENSIONS[contentType] };
}
