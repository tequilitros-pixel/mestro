import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cleanText, optionalCleanText, plainObject } from "@/lib/inputValidation";

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
  const body = plainObject(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const name = body.name === undefined ? undefined : cleanText(body.name, { min: 2, max: 100 });
  const address = body.address === undefined ? undefined : optionalCleanText(body.address, 250);
  const active = body.active === undefined ? undefined : body.active;
  if (name === null || (body.address !== undefined && address === null && body.address !== "") || (active !== undefined && typeof active !== "boolean")) {
    return NextResponse.json({ error: "Datos de sucursal inválidos" }, { status: 400 });
  }

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
