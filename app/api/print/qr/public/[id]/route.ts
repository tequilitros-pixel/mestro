import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { requireModuleActionAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type RouteProps = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteProps) {
  try { await requireModuleActionAccess("/liquors/qr"); } catch { return new Response("No autorizado", { status: 401 }); }
  const { id } = await params;
  const profile = await prisma.publicQrProfile.findUnique({ where: { publicId: id }, select: { publicId: true, productName: true, lotCode: true, batchId: true, status: true } });
  if (!profile || profile.status === "ARCHIVADO") return new Response("QR no disponible", { status: 404 });
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  const publicUrl = `${origin}${profile.batchId ? "/q/licor/" : "/q/tequila/"}${profile.publicId}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { errorCorrectionLevel: "M", margin: 4, width: 800 });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([142, 85]);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 0, width: 142, height: 85, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 0.6 });
  page.drawImage(await pdf.embedPng(Buffer.from(qrDataUrl.split(",")[1], "base64")), { x: 68, y: 6, width: 72, height: 72 });
  page.drawText("DESTILADORA", { x: 8, y: 68, font, size: 10, color: rgb(0.08, 0.23, 0.2) });
  page.drawText("DEL NORTE", { x: 8, y: 55, font, size: 8, color: rgb(0.08, 0.23, 0.2) });
  drawFittedText(page, profile.productName.toUpperCase(), { x: 8, y: 39, font, maxWidth: 54, maxSize: 8, minSize: 4, color: rgb(0, 0, 0) });
  if (profile.lotCode) drawFittedText(page, profile.lotCode, { x: 8, y: 28, font, maxWidth: 54, maxSize: 6, minSize: 3, color: rgb(0, 0, 0) });
  page.drawText("ESCANEA PARA VER LA FICHA", { x: 8, y: 12, font, size: 4.2, color: rgb(0, 0, 0) });
  const bytes = await pdf.save();
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(bytes as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="qr-${profile.productName.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf"`, "Cache-Control": "private, no-store" } });
}

function drawFittedText(page: import("pdf-lib").PDFPage, text: string, options: { x: number; y: number; font: import("pdf-lib").PDFFont; maxSize: number; minSize: number; maxWidth: number; color: ReturnType<typeof rgb> }) {
  let size = options.maxSize;
  while (size > options.minSize && options.font.widthOfTextAtSize(text, size) > options.maxWidth) size -= 0.2;
  page.drawText(text, { x: options.x, y: options.y, font: options.font, size: Math.max(size, options.minSize), color: options.color });
}
