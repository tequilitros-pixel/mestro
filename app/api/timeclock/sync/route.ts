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
    const coords = coordsValue(payload.coords);
    if (!branchId || !clockIn) return response("Datos de entrada inválidos", 400);

    const duplicate = await prisma.timeClockEntry.findUnique({ where: { id: operation.id } });
    if (duplicate) return NextResponse.json({ success: true, duplicate: true });
    const existingOpen = await prisma.timeClockEntry.findFirst({ where: { userId: user.id, clockOut: null } });
    if (existingOpen) return response("Ya existe un turno abierto", 409);
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: BRANCH_LOCATION_SELECT });
    if (!branch) return response("Sucursal no encontrada", 404);
    const geofence = checkGeofence(branch, coords);
    if (geofence && "error" in geofence) return response(geofence.error, 409);
    const scheduledShiftId = await matchTodaysScheduledShift(user.id, branchId);
    await prisma.timeClockEntry.create({ data: { id: operation.id, userId: user.id, branchId, clockIn, scheduledShiftId, createdAt: clockIn } });
    return NextResponse.json({ success: true });
  }

  const entryId = stringValue(payload.entryId);
  const clockOut = dateValue(payload.clockOut);
  const coords = coordsValue(payload.coords);
  if (!entryId || !clockOut) return response("Datos de salida inválidos", 400);
  const entry = await prisma.timeClockEntry.findUnique({ where: { id: entryId }, include: { branch: { select: BRANCH_LOCATION_SELECT } } });
  if (!entry || entry.userId !== user.id) return response("Turno no encontrado", 404);
  if (entry.clockOut) return NextResponse.json({ success: true, duplicate: true });
  if (clockOut <= entry.clockIn) return response("La salida debe ser posterior a la entrada", 400);
  const geofence = checkGeofence(entry.branch, coords);
  if (geofence && "error" in geofence) return response(geofence.error, 409);
  await prisma.timeClockEntry.update({ where: { id: entryId }, data: { clockOut, confirmedByEmployee: true } });
  return NextResponse.json({ success: true });
}

function response(error: string, status: number) { return NextResponse.json({ success: false, error }, { status }); }
function stringValue(value: unknown) { return typeof value === "string" && value ? value : null; }
function dateValue(value: unknown) { const date = typeof value === "string" ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; }
function coordsValue(value: unknown): Coords | undefined {
  if (!value || typeof value !== "object") return undefined;
  const coords = value as Record<string, unknown>;
  return typeof coords.latitude === "number" && typeof coords.longitude === "number" ? { latitude: coords.latitude, longitude: coords.longitude } : undefined;
}
