"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { assertActiveBranch } from "@/lib/workforce/branchLifecycle";
import { signalTimesheetsForEmployment } from "@/lib/workforce/timesheet/service";
import { normalizeBranchCode, validBranchCode, validGeofenceConfig, validTimezone } from "@/lib/workforce/branch";
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
}) {
  const admin = await requireAdmin();
  const name = input.name.trim();
  const code = normalizeBranchCode(input.code);
  if (name.length < 2 || !validBranchCode(code)) return { error: "Nombre o código de sucursal inválido." };
  if (!validTimezone(input.timezone)) return { error: "La zona horaria IANA no es válida." };
  try {
    await withRlsContext(admin, async (tx) => {
      if (await tx.branch.findFirst({ where: { code, id: { not: input.branchId } }, select: { id: true } })) throw new Error("Ya existe una sucursal con ese código.");
      if (input.defaultScheduleTemplateId) {
        const template = await tx.scheduleTemplate.findFirst({ where: { id: input.defaultScheduleTemplateId, branchId: input.branchId, active: true }, select: { id: true } });
        if (!template) throw new Error("La plantilla no pertenece a esta sucursal.");
      }
      await tx.branch.update({
        where: { id: input.branchId },
        data: { name, code, address: input.address?.trim() || null, timezone: input.timezone, active: input.active, templateApplyMode: "ASK_BEFORE_APPLY", defaultScheduleTemplateId: input.defaultScheduleTemplateId || null },
      });
    });
    revalidatePath(BRANCHES_PATH);
    revalidatePath("/administration/workforce/schedule");
    return { success: true } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar." };
  }
}

export async function updateBranchGeofenceAction(input: { branchId: string; enabled: boolean; latitude: number; longitude: number; radius: number }) {
  const admin = await requireAdmin();
  if (input.enabled && !validGeofenceConfig(input.latitude, input.longitude, input.radius)) return { error: "Coordenadas o radio de geozona inválidos." };
  try {
    await withRlsContext(admin, async (tx) => {
      const branch = await tx.branch.findUnique({ where: { id: input.branchId }, include: { geofence: { include: { branches: { select: { id: true } } } } } });
      if (!branch) throw new Error("Sucursal no encontrada.");
      if (!input.enabled) {
        await tx.branch.update({ where: { id: branch.id }, data: { geofenceEnabled: false } });
        return;
      }
      await assertActiveBranch(tx, branch.id);
      let geofenceId = branch.geofenceId;
      if (!branch.geofence || branch.geofence.branches.length > 1) {
        geofenceId = (await tx.geofence.create({ data: { name: `${branch.name} · geozona`, latitude: input.latitude, longitude: input.longitude, radius: input.radius } })).id;
      } else {
        await tx.geofence.update({ where: { id: branch.geofence.id }, data: { latitude: input.latitude, longitude: input.longitude, radius: input.radius } });
      }
      await tx.branch.update({ where: { id: branch.id }, data: { geofenceId, geofenceEnabled: true } });
    });
    revalidatePath(BRANCHES_PATH);
    revalidatePath("/workforce/clock");
    revalidatePath("/workforce/kiosk");
    return { success: true } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar la geozona." };
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
