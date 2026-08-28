import "server-only";
import { prisma } from "@/lib/prisma";

export async function decideAttendanceException(
  actor: { id: string; role: string },
  input: {
    exceptionId: string;
    decision: "RESOLVED" | "DISMISSED";
    resolution: string;
  },
) {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  if (input.resolution.trim().length < 5)
    throw new Error("La resolución requiere al menos 5 caracteres.");
  const item = await prisma.attendanceException.findUnique({
    where: { id: input.exceptionId },
  });
  if (!item || item.status !== "OPEN")
    throw new Error("La excepción ya es final o no existe.");
  return prisma.attendanceException.update({
    where: { id: item.id },
    data: {
      status: input.decision,
      resolvedById: actor.id,
      resolvedAt: new Date(),
      resolution: input.resolution.trim(),
    },
  });
}
