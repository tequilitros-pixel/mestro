import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { isUuidV7 } from "@/lib/pos2/operationId";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const status = params.get("status")?.toUpperCase();
  const clientOperationId = params.get("clientOperationId") ?? undefined;
  if (clientOperationId && !isUuidV7(clientOperationId)) return NextResponse.json({ error: "clientOperationId inválido" }, { status: 400 });
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const createdAt = dateFrom || dateTo ? {
    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
    ...(dateTo ? { lt: new Date(dateTo) } : {}),
  } : undefined;
  const action = status === "FAIL" ? "POS2_OPERATION_FAIL" : status === "SUCCESS" ? "POS2_OPERATION_SUCCESS" : { in: ["POS2_OPERATION_FAIL", "POS2_OPERATION_SUCCESS", "POS2_OPERATION_ATTEMPTED"] };

  const events = await withRlsContext(user, (tx) => tx.auditEvent.findMany({
    where: {
      entityType: "Pos2Operation",
      action,
      ...(clientOperationId ? { operationId: clientOperationId } : {}),
      ...(params.get("userId") ? { actorId: params.get("userId")! } : {}),
      ...(params.get("branchId") ? { branchId: params.get("branchId")! } : {}),
      ...(params.get("terminalId") ? { terminalId: params.get("terminalId")! } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  }));

  return NextResponse.json({ attempts: events });
}
