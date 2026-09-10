"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { assertActiveBranch } from "@/lib/workforce/branchLifecycle";
import { signalTimesheetsForEmployment } from "@/lib/workforce/timesheet/service";
import { normalizeBranchCode, validBranchCode, validTimezone } from "@/lib/workforce/branch";
import { getBranchGeofenceSaveState, persistBranchGeofence, type BranchGeofenceSaveInput } from "@/lib/workforce/geofencePersistence";
import { rangesOverlap, shiftRangeMinutes, validBreakMinutes, validTemplateWeekday } from "@/lib/workforce/scheduleTemplate";

const BRANCHES_PATH = "/administration/workforce/branches";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("No tienes permiso.");
  return user;
}

export async function getWorkforceBranchesData() {
  const admin = await requireAdmin();
  return withRlsContext(admin, async (tx) => {
    const now = new Date();
    const [branches, templates, settings, pendingEvidence] = await Promise.all([
      tx.branch.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: {
          geofence: true,
          defaultScheduleTemplate: { select: { id: true, name: true, active: true } },
          workforceAssignments: {
            where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
            include: { employment: { include: { employee: true } } },
            orderBy: { effectiveFrom: "asc" },
          },
          _count: { select: { workforceClockEvents: true, workforceShifts: true } },
        },
      }),
      tx.scheduleTemplate.findMany({
        where: { active: true },
        include: { shifts: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
        orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      }),
      tx.workforcePolicyVersion.findFirst({
        where: { effectiveFrom: { lte: now } },
        orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
      }),
      tx.clockGeolocationEvidence.findMany({
        where: { reviewStatus: "PENDING" },
        orderBy: { checkedAt: "desc" },
        take: 25,
        include: {
          clockEvent: {
            include: {
              employment: { include: { employee: true } },
              branch: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);
    if (!settings) throw new Error("WORKFORCE_POLICY_MISSING");
    return { branches, templates, settings, pendingEvidence };
  });
}

export async function createWorkforceBranchAction(input: { name: string; code: string; address?: string; timezone: string }) {
  const admin = await requireAdmin();
  const name = input.name.trim();
  const code = normalizeBranchCode(input.code);
  if (name.length < 2 || !validBranchCode(code)) return { error: "Nombre o código de sucursal inválido." };
  if (!validTimezone(input.timezone)) return { error: "La zona horaria IANA no es válida." };
  try {
    await withRlsContext(admin, async (tx) => {
      if (await tx.branch.findUnique({ where: { code }, select: { id: true } })) throw new Error("Ya existe una sucursal con ese código.");
      await tx.branch.create({ data: { name, code, address: input.address?.trim() || null, timezone: input.timezone, geofenceEnabled: false } });
    });
    revalidatePath(BRANCHES_PATH);
    return { success: true } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la sucursal." };
  }
}

export async function updateWorkforceBranchAction(input: {
  branchId: string; name: string; code: string; address?: string; timezone: string; active: boolean;
  templateApplyMode: "ASK_BEFORE_APPLY" | "AUTO_CREATE_DRAFT" | "DO_NOT_APPLY";
  defaultScheduleTemplateId?: string | null;
  geofence?: BranchGeofenceSaveInput;
}) {
  const admin = await requireAdmin();
  const name = input.name.trim();
  const code = normalizeBranchCode(input.code);
  if (name.length < 2 || !validBranchCode(code)) return { error: "Nombre o código de sucursal inválido." };
  if (!validTimezone(input.timezone)) return { error: "La zona horaria IANA no es válida." };
  const geofenceState = input.geofence ? getBranchGeofenceSaveState(input.geofence) : null;
  if (geofenceState?.error) return { error: geofenceState.error };
  try {
    await withRlsContext(admin, async (tx) => {
      if (await tx.branch.findFirst({ where: { code, id: { not: input.branchId } }, select: { id: true } })) throw new Error("Ya existe una sucursal con ese código.");
      if (input.defaultScheduleTemplateId) {
        const template = await tx.scheduleTemplate.findFirst({ where: { id: input.defaultScheduleTemplateId, branchId: input.branchId, active: true }, select: { id: true } });
        if (!template) throw new Error("La plantilla no pertenece a esta sucursal.");
      }
      const branch = input.geofence
        ? await tx.branch.findUnique({ where: { id: input.branchId }, include: { geofence: { include: { branches: { select: { id: true } } } } } })
        : null;
      if (input.geofence && !branch) throw new Error("Sucursal no encontrada.");
      await tx.branch.update({
        where: { id: input.branchId },
        data: { name, code, address: input.address?.trim() || null, timezone: input.timezone, active: input.active, templateApplyMode: "ASK_BEFORE_APPLY", defaultScheduleTemplateId: input.defaultScheduleTemplateId || null },
      });
      if (input.geofence) {
        if (geofenceState!.shouldEnable) await assertActiveBranch(tx, input.branchId);
        await persistBranchGeofence(tx, { ...branch!, name }, input.geofence, geofenceState!);
      }
    });
    revalidatePath(BRANCHES_PATH);
    revalidatePath("/administration/workforce/schedule");
    return { success: true } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar." };
  }
}

export async function updateBranchGeofenceAction(input: { branchId: string } & BranchGeofenceSaveInput) {
  const admin = await requireAdmin();
  const geofenceState = getBranchGeofenceSaveState(input);
  if (geofenceState.error) return { error: geofenceState.error };
  try {
    await withRlsContext(admin, async (tx) => {
      const branch = await tx.branch.findUnique({ where: { id: input.branchId }, include: { geofence: { include: { branches: { select: { id: true } } } } } });
      if (!branch) throw new Error("Sucursal no encontrada.");
      if (geofenceState.shouldEnable) await assertActiveBranch(tx, branch.id);
      await persistBranchGeofence(tx, branch, input, geofenceState);
    });
    revalidatePath(BRANCHES_PATH);
    revalidatePath("/workforce/clock");
    revalidatePath("/workforce/kiosk");
    return { success: true } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar la geozona." };
  }
}

let lastAddressSearchAt = 0;

export async function searchBranchAddressAction(query: string) {
  await requireAdmin();
  const normalized = query.trim();
  if (normalized.length < 3) return { error: "Escribe al menos 3 caracteres para buscar." } as const;
  if (Date.now() - lastAddressSearchAt < 1000) return { error: "Espera un momento antes de buscar otra vez." } as const;

  lastAddressSearchAt = Date.now();
  const endpoint = process.env.MAESTRO_GEOCODER_URL ?? "https://nominatim.openstreetmap.org/search";
  const url = new URL(endpoint);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "mx");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", normalized);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "es-MX,es;q=0.9",
        "User-Agent": "MAESTRO geofence admin search (+https://maestro-destiladora.space)",
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { error: "El buscador de lugares no está disponible." } as const;
    const payload: unknown = await response.json();
    const results = Array.isArray(payload)
      ? payload.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          const latitude = Number(record.lat);
          const longitude = Number(record.lon);
          const displayName = typeof record.display_name === "string" ? record.display_name.trim() : "";
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !displayName) return [];
          return [{ placeId: String(record.place_id ?? `${latitude}:${longitude}`), displayName, latitude, longitude }];
        })
      : [];
    return { results } as const;
  } catch {
    return { error: "No pudimos consultar el buscador de lugares." } as const;
  }
}

export async function saveWorkforceScheduleTemplateAction(input: {
  templateId?: string; branchId: string; name: string; active: boolean;
  blocks: Array<{ dayOfWeek: number; startTime: string; endTime: string; breakMinutes: number }>;
}) {
  const admin = await requireAdmin();
  const name = input.name.trim();
  if (name.length < 2) return { error: "El nombre de la plantilla es obligatorio." };
  if (!input.blocks.length) return { error: "Agrega al menos un bloque horario." };
  if (input.blocks.some((block) => !validTemplateWeekday(block.dayOfWeek) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(block.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(block.endTime) || !validBreakMinutes(block.breakMinutes))) return { error: "Hay un bloque de plantilla inválido." };
  for (let index = 0; index < input.blocks.length; index++) {
    const block = input.blocks[index];
    if (input.blocks.slice(index + 1).some((other) => other.dayOfWeek === block.dayOfWeek && rangesOverlap(shiftRangeMinutes(block.startTime, block.endTime), shiftRangeMinutes(other.startTime, other.endTime)))) return { error: "Los bloques de un mismo día no pueden traslaparse." };
  }
  try {
    await withRlsContext(admin, async (tx) => {
      await assertActiveBranch(tx, input.branchId);
      const shifts = input.blocks.map((block) => ({ ...block, branchId: input.branchId, type: "TURNO" as const }));
      if (input.templateId) {
        const template = await tx.scheduleTemplate.findFirst({ where: { id: input.templateId, branchId: input.branchId }, select: { id: true } });
        if (!template) throw new Error("Plantilla no encontrada.");
        await tx.scheduleTemplate.update({ where: { id: template.id }, data: { name, active: input.active, shifts: { deleteMany: {}, create: shifts } } });
        if (!input.active) await tx.branch.updateMany({ where: { defaultScheduleTemplateId: template.id }, data: { defaultScheduleTemplateId: null } });
      } else {
        await tx.scheduleTemplate.create({ data: { name, active: input.active, branchId: input.branchId, createdById: admin.id, shifts: { create: shifts } } });
      }
    });
    revalidatePath(BRANCHES_PATH);
    revalidatePath("/administration/workforce/schedule");
    return { success: true } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar la plantilla." };
  }
}

export async function reviewGeolocationEvidenceAction(evidenceId: string, decision: "APPROVED" | "REJECTED") {
  const admin = await requireAdmin();
  if (decision !== "APPROVED" && decision !== "REJECTED") return { error: "Decisión inválida." };
  try {
    await withRlsContext(admin, async (tx) => {
      const evidence = await tx.clockGeolocationEvidence.findFirst({ where: { id: evidenceId, reviewStatus: "PENDING" } });
      if (!evidence) throw new Error("La excepción ya fue revisada o no existe.");
      const now = new Date();
      const updated = await tx.clockGeolocationEvidence.updateMany({ where: { id: evidence.id, reviewStatus: "PENDING" }, data: { reviewStatus: decision, reviewedById: admin.id, reviewedAt: now } });
      if (updated.count !== 1) throw new Error("La excepción ya fue revisada.");
      if (decision === "APPROVED" && evidence.attendanceExceptionId) {
        await tx.attendanceException.updateMany({ where: { id: evidence.attendanceExceptionId, status: "OPEN" }, data: { status: "RESOLVED", resolvedById: admin.id, resolvedAt: now, resolution: "Ubicación aprobada por manager." } });
        const exception = await tx.attendanceException.findUniqueOrThrow({ where: { id: evidence.attendanceExceptionId } });
        await signalTimesheetsForEmployment(tx, exception.employmentId);
      }
    });
    revalidatePath(BRANCHES_PATH);
    revalidatePath("/administration/workforce/attendance");
    return { success: true } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo revisar." };
  }
}
