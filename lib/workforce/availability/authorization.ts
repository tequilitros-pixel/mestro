export function assertAvailabilityAccess(input: { actorUserId: string; actorRole: string; employeeUserId: string | null; employeeId: string; requestedEmployeeId: string }) {
  if (input.actorRole === "ADMIN") return;
  if (!input.employeeUserId || input.actorUserId !== input.employeeUserId || input.employeeId !== input.requestedEmployeeId) throw new Error("No autorizado para la disponibilidad de este empleado.");
}
