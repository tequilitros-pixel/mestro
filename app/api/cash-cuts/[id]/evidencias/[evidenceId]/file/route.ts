import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getCashCutScope, withCashCutScope } from "@/lib/cash-cuts/access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const scope = await getCashCutScope();
  if (!scope) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { id, evidenceId } = await params;

  // El alcance se aplica sobre el corte dueno de la evidencia: si el
  // corte no entra en lo que este usuario puede ver, el archivo
  // simplemente no existe para el.
  const evidence = await prisma.cashCutEvidence.findFirst({
    where: {
      id: evidenceId,
      cashCutId: id,
      cashCut: withCashCutScope(scope),
    },
    select: { url: true },
  });
  if (!evidence || evidence.url.startsWith("http")) {
    return Response.json({ error: "Evidencia no encontrada" }, { status: 404 });
  }

  const result = await get(evidence.url, {
    access: "private",
    ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
  });
  if (!result) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });
  if (result.statusCode === 304) return new Response(null, { status: 304 });

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Length": String(result.blob.size),
      "Cache-Control": "private, max-age=300",
      ETag: result.blob.etag,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
