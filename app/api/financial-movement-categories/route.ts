import { NextResponse } from "next/server";
import { getCurrentUser, requireAdminAction } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const direction = url.searchParams.get("direction");
  const scope = url.searchParams.get("scope");
  const categories = await prisma.financialMovementCategory.findMany({ where: { isActive: true, ...(direction === "INCOME" || direction === "EXPENSE" ? { direction } : {}), ...(scope === "CASH" || scope === "ENVELOPE" ? { OR: [{ scope }, { scope: "BOTH" }] } : {}) }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const user = await requireAdminAction();
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (name.length < 2 || !/^[A-Z0-9_]{2,80}$/.test(code) || !["INCOME", "EXPENSE"].includes(body.direction) || !["CASH", "ENVELOPE", "BOTH"].includes(body.scope)) return NextResponse.json({ error: "Datos de categoría inválidos" }, { status: 400 });
  const category = await prisma.financialMovementCategory.create({ data: { name, code, direction: body.direction, scope: body.scope, group: typeof body.group === "string" ? body.group.trim() || null : null, requiresReason: body.requiresReason === true, requiresReceipt: body.requiresReceipt === true, sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : 0, createdById: user.id, updatedById: user.id } });
  return NextResponse.json(category, { status: 201 });
}
