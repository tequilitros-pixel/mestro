"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatDateOnly, mondayOfWeek, parseDateOnly } from "@/lib/dateOnly";
import { isPayrollDateLocked, PAYROLL_LOCKED_MESSAGE } from "@/lib/payroll/periodLock";

export type ShiftRequestKind = "CANNOT_WORK" | "CHANGE_TIME" | "SWAP" | "DAY_OFF";

export async function getMyShiftRequests() {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.shiftChangeRequest.findMany({
    where: { requestedById: user.id },
    include: { shift: { include: { branch: { select: { name: true } } } }, swapTargetUser: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyPublishedUpcomingShifts() {
  const user = await getCurrentUser();
  if (!user) return [];
  const shifts = await prisma.scheduledShift.findMany({
    where: { userId: user.id, type: "TURNO", date: { gte: parseDateOnly(formatDateOnly(new Date())) } },
    include: { branch: { select: { name: true } } }, orderBy: { date: "asc" }, take: 30,
  });
  const weeks = await prisma.scheduleWeek.findMany({ where: { weekStart: { in: [...new Set(shifts.map((s) => mondayOfWeek(formatDateOnly(s.date))))].map(parseDateOnly) } } });
  const status = new Map(weeks.map((w) => [formatDateOnly(w.weekStart), w.status]));
  return shifts.filter((shift) => status.get(mondayOfWeek(formatDateOnly(shift.date))) !== "DRAFT");
}

export async function getSwapCandidates() {
  const user = await getCurrentUser();
  if (!user) return [];
  const branchIds = await prisma.userBranch.findMany({ where: { userId: user.id }, select: { branchId: true } });
  return prisma.user.findMany({
    where: { active: true, id: { not: user.id }, branches: { some: { branchId: { in: branchIds.map((b) => b.branchId) } } } },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  });
}

export async function createShiftRequestAction(input: { shiftId: string; type: ShiftRequestKind; reason: string; proposedStartTime?: string; proposedEndTime?: string; swapTargetUserId?: string }) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" };
  const shift = await prisma.scheduledShift.findUnique({ where: { id: input.shiftId } });
  if (!shift || shift.userId !== user.id) return { error: "Turno no encontrado." };
  if (await isPayrollDateLocked(shift.date)) return { error: PAYROLL_LOCKED_MESSAGE };
  const week = await prisma.scheduleWeek.findUnique({ where: { weekStart: parseDateOnly(mondayOfWeek(formatDateOnly(shift.date))) } });
  if (week?.status === "DRAFT") return { error: "Solo puedes solicitar cambios sobre horarios publicados." };
  if (!input.reason.trim()) return { error: "Explica el motivo de la solicitud." };
  if (input.type === "CHANGE_TIME" && (!input.proposedStartTime || !input.proposedEndTime)) return { error: "Indica el horario solicitado." };
  if (input.type === "SWAP" && !input.swapTargetUserId) return { error: "Selecciona con quién deseas intercambiar." };
  const pending = await prisma.shiftChangeRequest.findFirst({ where: { shiftId: shift.id, requestedById: user.id, status: "PENDING" } });
  if (pending) return { error: "Ya tienes una solicitud pendiente para este turno." };
  await prisma.shiftChangeRequest.create({ data: {
    shiftId: shift.id, requestedById: user.id, type: input.type, reason: input.reason.trim(),
    proposedStartTime: input.type === "CHANGE_TIME" ? input.proposedStartTime : null,
    proposedEndTime: input.type === "CHANGE_TIME" ? input.proposedEndTime : null,
    swapTargetUserId: input.type === "SWAP" ? input.swapTargetUserId : null,
  } });
  revalidatePath("/timeclock/requests"); revalidatePath("/administration/schedule");
  return { success: true };
}

export async function cancelShiftRequestAction(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" };
  const request = await prisma.shiftChangeRequest.findUnique({ where: { id } });
  if (!request || request.requestedById !== user.id || request.status !== "PENDING") return { error: "La solicitud ya no puede cancelarse." };
  await prisma.shiftChangeRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/timeclock/requests"); return { success: true };
}

export async function getShiftRequestsForAdmin() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return [];
  return prisma.shiftChangeRequest.findMany({
    where: { status: "PENDING" },
    include: { requestedBy: { select: { name: true } }, swapTargetUser: { select: { id: true, name: true } }, shift: { include: { branch: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function reviewShiftRequestAction(id: string, approve: boolean, reviewNotes?: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return { error: "No tienes permiso" };
  const request = await prisma.shiftChangeRequest.findUnique({ where: { id }, include: { shift: true } });
  if (!request || request.status !== "PENDING") return { error: "La solicitud ya fue revisada." };
  if (await isPayrollDateLocked(request.shift.date)) return { error: PAYROLL_LOCKED_MESSAGE };
  await prisma.$transaction(async (tx) => {
    await tx.shiftChangeRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedById: admin.id, reviewedAt: new Date(), reviewNotes: reviewNotes?.trim() || null } });
    if (!approve) return;
    if (request.type === "CHANGE_TIME") await tx.scheduledShift.update({ where: { id: request.shiftId }, data: { startTime: request.proposedStartTime, endTime: request.proposedEndTime } });
    if (request.type === "SWAP" && request.swapTargetUserId) await tx.scheduledShift.update({ where: { id: request.shiftId }, data: { userId: request.swapTargetUserId } });
    if (request.type === "CANNOT_WORK" || request.type === "DAY_OFF") await tx.scheduledShift.update({ where: { id: request.shiftId }, data: { type: "DESCANSO", branchId: null, startTime: null, endTime: null, eventId: null } });
  });
  revalidatePath("/timeclock/requests"); revalidatePath("/timeclock/calendar"); revalidatePath("/administration/schedule");
  return { success: true };
}
