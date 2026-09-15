import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BRANCH_LOCATION_SELECT, matchTodaysScheduledShift } from "@/lib/timeclockShared";
import type { OfflineOperation } from "@/lib/offline/types";
import { evaluateGeofence, geofenceDecision, geofenceMessage, type LocationInput } from "@/lib/workforce/geofence";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.active) return response("No autorizado", 401);
  const operation = (await request.json().catch(() => null)) as OfflineOperation | null;
  if (!operation?.id || !operation.payload || !["timeclock.clock-in", "timeclock.clock-out"].includes(operation.kind)) return response("Operación inválida", 400);
  const payload = operation.payload as Record<string, unknown>;

  if (operation.kind === "timeclock.clock-in") {
    const branchId = stringValue(payload.branchId);
    const clockIn = dateValue(payload.clockIn);
    const location = locationValue(payload.location ?? payload.coords);
    if (!branchId || !clockIn) return response("Datos de entrada inválidos", 400);
    const duplicate = await prisma.timeClockEntry.findUnique({ where: { id: operation.id } });
    if (duplicate) return NextResponse.json({ success: true, duplicate: true });
    const existingOpen = await prisma.timeClockEntry.findFirst({ where: { userId: user.id, clockOut: null } });
    if (existingOpen) return response("Ya existe un turno abierto", 409);
    const [branch, assignment, policy] = await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId }, select: BRANCH_LOCATION_SELECT }),
      prisma.userBranch.findUnique({ where: { userId_branchId: { userId: user.id, branchId } }, select: { id: true } }),
      prisma.workforceSettings.upsert({ where: { id: "default" }, update: {}, create: {} }),
    ]);
    if (!branch?.active) return response("Sucursal no encontrada", 404);
    const scheduledShiftId = await matchTodaysScheduledShift(user.id, branchId);
    if (!assignment && !scheduledShiftId) return response("Sucursal no autorizada", 403);
    const geofence = evaluateGeofence(branch, location, policy.requireGeolocationClockIn, policy.maximumAccuracyMeters);
    const decision = geofenceDecision(geofence.result, policy.outsideBehavior);
    if (!decision.allow) return response(geofenceMessage(geofence) ?? "No se pudo validar la ubicación", 409);
    await prisma.$transaction(async (tx) => {
      await tx.timeClockEntry.create({ data: { id: operation.id, userId: user.id, branchId, clockIn, scheduledShiftId, createdAt: clockIn } });
      await tx.clockGeolocationEvidence.create({ data: { timeClockId: operation.id, action: "CLOCK_IN", result: geofence.result, distanceMeters: geofence.distanceMeters, accuracyMeters: geofence.accuracyMeters, checkedAt: geofence.checkedAt, reviewStatus: decision.needsReview && policy.requireOutsideReview ? "PENDING" : "NOT_REQUIRED" } });
    });
    return NextResponse.json({ success: true });
  }

  const entryId = stringValue(payload.entryId);
  const clockIn = dateValue(payload.clockIn);
  const clockOut = dateValue(payload.clockOut);
  const location = locationValue(payload.location ?? payload.coords);
  if (!entryId || !clockOut) return response("Datos de salida inválidos", 400);
  const entry = await prisma.timeClockEntry.findUnique({ where: { id: entryId }, include: { branch: { select: BRANCH_LOCATION_SELECT } } });
  if (!entry || entry.userId !== user.id) return response("Turno no encontrado", 404);
  if (entry.clockOut) return NextResponse.json({ success: true, duplicate: true });
  const adjustedClockIn = clockIn ?? entry.clockIn;
  if (clockOut <= adjustedClockIn) return response("La salida debe ser posterior a la entrada", 400);
  const forgottenSession = payload.forgottenSession === true;
  if (forgottenSession && Date.now() - entry.clockIn.getTime() < 24 * 60 * 60 * 1000) return response("Esta sesión todavía no cumple el mínimo para cierre excepcional", 400);
  if (forgottenSession) {
    await prisma.timeClockEntry.update({
      where: { id: entryId },
      data: { clockIn: adjustedClockIn, clockOut, confirmedByEmployee: false, notes: entry.notes ? `${entry.notes}\nCierre excepcional de sesión olvidada; requiere revisión de nómina.` : "Cierre excepcional de sesión olvidada; requiere revisión de nómina." },
    });
    return NextResponse.json({ success: true, warning: "Cierre excepcional marcado para revisión de nómina." });
  }
  const policy = await prisma.workforceSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
  const geofence = evaluateGeofence(entry.branch, location, policy.requireGeolocationClockOut, policy.maximumAccuracyMeters);
  const decision = geofenceDecision(geofence.result, policy.outsideBehavior);
  if (!decision.allow) return response(geofenceMessage(geofence) ?? "No se pudo validar la ubicación", 409);
  await prisma.$transaction(async (tx) => {
    await tx.timeClockEntry.update({ where: { id: entryId }, data: { clockIn: adjustedClockIn, clockOut, confirmedByEmployee: true } });
    await tx.clockGeolocationEvidence.upsert({ where: { timeClockId_action: { timeClockId: entryId, action: "CLOCK_OUT" } }, update: {}, create: { timeClockId: entryId, action: "CLOCK_OUT", result: geofence.result, distanceMeters: geofence.distanceMeters, accuracyMeters: geofence.accuracyMeters, checkedAt: geofence.checkedAt, reviewStatus: decision.needsReview && policy.requireOutsideReview ? "PENDING" : "NOT_REQUIRED" } });
  });
  return NextResponse.json({ success: true });
}

function response(error: string, status: number) { return NextResponse.json({ success: false, error }, { status }); }
function stringValue(value: unknown) { return typeof value === "string" && value ? value : null; }
function dateValue(value: unknown) { const date = typeof value === "string" ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; }
function locationValue(value: unknown): LocationInput {
  if (!value || typeof value !== "object") return { failure: "UNAVAILABLE" };
  const location = value as Record<string, unknown>;
  if (location.failure === "PERMISSION_DENIED" || location.failure === "UNAVAILABLE") return { failure: location.failure };
  const sample = (location.sample && typeof location.sample === "object" ? location.sample : location) as Record<string, unknown>;
  return typeof sample.latitude === "number" && typeof sample.longitude === "number"
    ? { sample: { latitude: sample.latitude, longitude: sample.longitude, accuracyMeters: typeof sample.accuracyMeters === "number" ? sample.accuracyMeters : undefined, checkedAt: typeof sample.checkedAt === "string" ? sample.checkedAt : undefined } }
    : { failure: "UNAVAILABLE" };
}
