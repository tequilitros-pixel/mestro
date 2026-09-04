import "server-only";
import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { authenticateTerminal } from "@/lib/pos2/terminals";
import { prisma } from "@/lib/prisma";
import { requirePos2ContextEnabled } from "@/lib/pos2/certification/rollout";

export async function requireTerminalRequest(request: Request) {
  const terminalId = request.headers.get("x-maestro-terminal-id") ?? "";
  const credential = request.headers.get("x-maestro-terminal-credential") ?? "";
  if (!terminalId || !credential) throw new DomainError("PERMISSION_DENIED");
  const terminal = await authenticateTerminal({ terminalId, credential });
  requirePos2ContextEnabled(terminal.branchId);
  return terminalId;
}

export async function requireOrderTerminal(terminalId: string, orderId: string) {
  const [terminal, order] = await Promise.all([
    prisma.terminal.findUnique({ where: { id: terminalId }, select: { branchId: true, status: true } }),
    prisma.pos2Order.findUnique({ where: { id: orderId }, select: { branchId: true, registerId: true } }),
  ]);
  if (!terminal || terminal.status !== "ACTIVE" || !order || terminal.branchId !== order.branchId) throw new DomainError("PERMISSION_DENIED", { terminalId, orderId });
  requirePos2ContextEnabled(order.branchId, order.registerId);
}

export async function requireTerminalBranch(terminalId: string, branchId: string, registerId?: string) {
  const terminal = await prisma.terminal.findUnique({ where: { id: terminalId }, select: { branchId: true, status: true } });
  if (!terminal || terminal.status !== "ACTIVE" || terminal.branchId !== branchId) throw new DomainError("PERMISSION_DENIED", { terminalId, branchId });
  requirePos2ContextEnabled(branchId, registerId);
}

export function pos2ErrorResponse(error: unknown) {
  if (error instanceof DomainError) return NextResponse.json(error.toResponse(), { status: error.httpStatus });
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "P2002" || code === "23505") return NextResponse.json(new DomainError("CONFLICT").toResponse(), { status: 409 });
  console.error("POS2 command failed", error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "No fue posible completar la operación." } }, { status: 500 });
}
