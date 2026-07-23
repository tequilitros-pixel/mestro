import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ROLES_QUE_PUEDEN_ADMINISTRAR = ["ADMIN"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ROLES_QUE_PUEDEN_ADMINISTRAR.includes(user.role)) {
    return NextResponse.json({ error: "Solo un administrador puede editar sucursales" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, address, active } = body;

  const branch = await prisma.branch.update({
    where: { id },
    data: {
      name: name ?? undefined,
      address: address ?? undefined,
      active: active ?? undefined,
    },
  });

  return NextResponse.json(branch);
}
