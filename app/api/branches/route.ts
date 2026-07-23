import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  if (user.role === "GERENTE" || user.role === "ENCARGADO") {
    const userBranches = await prisma.userBranch.findMany({
      where: { userId: user.id },
      include: { branch: true },
    });
    return NextResponse.json(userBranches.map((ub) => ub.branch));
  }

  const branches = await prisma.branch.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(branches);
}

const ROLES_QUE_PUEDEN_ADMINISTRAR = ["ADMIN"];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_QUE_PUEDEN_ADMINISTRAR.includes(user.role)) {
    return NextResponse.json({ error: "Solo un administrador puede crear sucursales" }, { status: 403 });
  }

  const body = await request.json();
  const { name, code, address } = body;

  if (!name || !code) {
    return NextResponse.json({ error: "Faltan datos: name, code" }, { status: 400 });
  }

  const existing = await prisma.branch.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una sucursal con ese código" }, { status: 409 });
  }

  const branch = await prisma.branch.create({
    data: { name, code: code.toUpperCase(), address },
  });

  return NextResponse.json(branch, { status: 201 });
}
