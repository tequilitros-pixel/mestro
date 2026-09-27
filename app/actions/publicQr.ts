"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireModuleActionAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PublicQrPayload, PublicQrVisibility } from "@/lib/publicQr";

const QR_PERMISSION = "/liquors/qr";

type PublicQrInput = {
  id?: string;
  lotId?: string | null;
  batchId?: string | null;
  payload: PublicQrPayload;
  visibility: PublicQrVisibility;
};

function parseInput(value: string): PublicQrInput {
  const input = JSON.parse(value) as PublicQrInput;
  if (!input || typeof input !== "object" || !input.payload || !input.visibility) {
    throw new Error("DATOS_QR_INVALIDOS");
  }
  return input;
}

function auditValues(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function changedFields(before: unknown, after: unknown, prefix = "") {
  const fields: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    const keys = new Set([...Object.keys(before as Record<string, unknown>), ...Object.keys(after as Record<string, unknown>)]);
    for (const key of keys) {
      fields.push(...changedFields((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key));
    }
    return fields;
  }
  if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
    fields.push({ field: prefix, oldValue: before, newValue: after });
  }
  return fields;
}

export async function savePublicQrAction(inputValue: string) {
  const user = await requireModuleActionAccess(QR_PERMISSION);
  const input = parseInput(inputValue);
  const payload = input.payload;
  const lotId = input.lotId || null;
  const batchId = input.batchId || null;
  if (lotId && batchId) throw new Error("QR_RELACIONES_INVALIDAS");
  let lotCode = payload.identification.lotCode.trim() || null;

  if (lotId) {
    const lot = await prisma.lot.findUnique({ where: { id: lotId }, select: { id: true, code: true } });
    if (!lot) throw new Error("LOTE_NO_ENCONTRADO");
    lotCode = lot.code;
  } else if (batchId) {
    const batch = await prisma.liquorBatch.findUnique({ where: { id: batchId }, select: { id: true, code: true } });
    if (!batch) throw new Error("LOTE_NO_ENCONTRADO");
    lotCode = batch.code;
  }
  if (!payload.product.commercialName.trim()) throw new Error("PRODUCTO_REQUERIDO");

  const data = {
    batchId,
    lotId,
    createdById: user.id,
    productName: payload.product.commercialName.trim(),
    lotCode,
    payload: payload as unknown as Prisma.InputJsonValue,
    visibility: input.visibility as unknown as Prisma.InputJsonValue,
  };

  if (!input.id) {
    const profile = await prisma.publicQrProfile.create({ data });
    revalidateQrPaths(profile.publicId);
    return { id: profile.id, publicId: profile.publicId };
  }

  const existing = await prisma.publicQrProfile.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("QR_NO_ENCONTRADO");
  if (existing.status === "ARCHIVADO") throw new Error("QR_ARCHIVADO");
  if (existing.lotId !== lotId || existing.batchId !== batchId) throw new Error("QR_RELACION_INMUTABLE");

  const oldPayload = existing.payload as unknown;
  const oldVisibility = existing.visibility as unknown;
  const audits = [
    ...changedFields(oldPayload, payload, "payload"),
    ...changedFields(oldVisibility, input.visibility, "visibility"),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.publicQrProfile.update({ where: { id: existing.id }, data: {
      lotId,
      batchId,
      productName: payload.product.commercialName.trim(),
      lotCode,
      payload: payload as unknown as Prisma.InputJsonValue,
      visibility: input.visibility as unknown as Prisma.InputJsonValue,
    } });
    if (audits.length) {
      await tx.publicQrAuditEvent.createMany({ data: audits.map((audit) => ({ profileId: existing.id, userId: user.id, field: audit.field, oldValue: auditValues(audit.oldValue), newValue: auditValues(audit.newValue) })) });
    }
  });
  revalidateQrPaths(existing.publicId);
  return { id: existing.id, publicId: existing.publicId };
}

export async function publishPublicQrAction(inputValue: string) {
  const result = await savePublicQrAction(inputValue);
  const user = await requireModuleActionAccess(QR_PERMISSION);
  const profile = await prisma.publicQrProfile.findUnique({ where: { id: result.id }, select: { id: true, publicId: true, status: true } });
  if (!profile) throw new Error("QR_NO_ENCONTRADO");
  if (profile.status !== "PUBLICADO") {
    await prisma.publicQrProfile.update({ where: { id: profile.id }, data: { status: "PUBLICADO", publishedAt: new Date() } });
    await prisma.publicQrAuditEvent.create({ data: { profileId: profile.id, userId: user.id, field: "status", oldValue: profile.status, newValue: "PUBLICADO" } });
  }
  revalidateQrPaths(profile.publicId);
  return { id: profile.id, publicId: profile.publicId };
}

export async function archivePublicQrAction(id: string) {
  const user = await requireModuleActionAccess(QR_PERMISSION);
  const profile = await prisma.publicQrProfile.findUnique({ where: { id }, select: { id: true, publicId: true, status: true } });
  if (!profile) throw new Error("QR_NO_ENCONTRADO");
  if (profile.status !== "ARCHIVADO") {
    await prisma.$transaction([
      prisma.publicQrProfile.update({ where: { id }, data: { status: "ARCHIVADO" } }),
      prisma.publicQrAuditEvent.create({ data: { profileId: id, userId: user.id, field: "status", oldValue: profile.status, newValue: "ARCHIVADO" } }),
    ]);
  }
  revalidateQrPaths(profile.publicId);
  return { ok: true };
}

function revalidateQrPaths(publicId: string) {
  revalidatePath("/liquors/production");
  revalidatePath("/liquors/production/qr");
  revalidatePath("/liquors/production/labels");
  revalidatePath(`/q/tequila/${publicId}`);
  revalidatePath(`/q/licor/${publicId}`);
}
