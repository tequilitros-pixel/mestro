import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BRANCH_LOCATION_SELECT, checkGeofence, matchTodaysScheduledShift, type Coords } from "@/lib/timeclockShared";
import type { OfflineOperation } from "@/lib/offline/types";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.active) return response("No autorizado", 401);
  const operation = (await request.json().catch(() => null)) as OfflineOperation | null;
  if (!operation?.id || !operation.payload || !["timeclock.clock-in", "timeclock.clock-out"].includes(operation.kind)) return response("Operación inválida", 400);
  const payload = operation.payload as Record<string, unknown>;

  if (operation.kind === "timeclock.clock-in") {
    const branchId = stringValue(payload.branchId);
    const clockIn = dateValue(payload.clockIn);
    const coords = coordsValue(payload.location ?? payload.coords);
    if (!branchId || !clockIn) return response("Datos de entrada inválidos", 400);
    const duplicate = await prisma.timeClockEntry.findUnique({ where: { id: operation.id } });
    if (duplicate) return NextResponse.json({ success: true, duplicate: true });
    const existingOpen = await prisma.timeClockEntry.findFirst({ where: { userId: user.id, clockOut: null } });
    if (existingOpen) return response("Ya existe un turno abierto", 409);
    const pendingEntry = await prisma.timeClockLocationRequest.findFirst({ where: { userId: user.id, status: "PENDIENTE", clockOut: null }, select: { id: true } });
    if (pendingEntry) return response("Ya existe una entrada sin ubicación pendiente", 409);
    const [branch, assignment] = await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId }, select: BRANCH_LOCATION_SELECT }),
      prisma.userBranch.findUnique({ where: { userId_branchId: { userId: user.id, branchId } }, select: { id: true } }),
    ]);
    if (!branch?.active) return response("Sucursal no encontrada", 404);
    const scheduledShiftId = await matchTodaysScheduledShift(user.id, branchId);
    if (!assignment && !scheduledShiftId) return response("Sucursal no autorizada", 403);
    const geofenceResult = checkGeofence(branch, coords);
    if (geofenceResult && "error" in geofenceResult) {
      return response(`${geofenceResult.error}. Usa el checador con conexión para enviar una entrada sin ubicación con nota a aprobación.`, 409);
    }
    await prisma.timeClockEntry.create({
      data: { id: operation.id, userId: user.id, branchId, clockIn, scheduledShiftId, createdAt: clockIn },
    });
    return NextResponse.json({ success: true });
  }

  const entryId = stringValue(payload.entryId);
  const clockIn = dateValue(payload.clockIn);
  const clockOut = dateValue(payload.clockOut);
  const coords = coordsValue(payload.location ?? payload.coords);
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
  const geofenceResult = checkGeofence(entry.branch, coords);
  if (geofenceResult && "error" in geofenceResult) {
    return response(geofenceResult.error, 409);
  }
  await prisma.timeClockEntry.update({
    where: { id: entryId },
    data: { clockIn: adjustedClockIn, clockOut, confirmedByEmployee: true },
  });
  return NextResponse.json({ success: true });
}

function response(error: string, status: number) { return NextResponse.json({ success: false, error }, { status }); }
function stringValue(value: unknown) { return typeof value === "string" && value ? value : null; }
function dateValue(value: unknown) { const date = typeof value === "string" ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; }
function coordsValue(value: unknown): Coords | null {
  if (!value || typeof value !== "object") return null;
  const val = value as Record<string, unknown>;
  const sample = (val.sample && typeof val.sample === "object" ? val.sample : val) as Record<string, unknown>;
  return typeof sample.latitude === "number" && typeof sample.longitude === "number"
    ? { latitude: sample.latitude, longitude: sample.longitude }
    : null;
}
