import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Catálogo completo para la pantalla de cobro: categorías activas
 * con sus productos y variantes activas. No incluye las recetas de
 * ingredientes (eso solo importa al cobrar/administrar el catálogo,
 * no para pintar la cuadrícula de venta).
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const categories = await prisma.posCategory.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
    include: {
      products: {
        where: { active: true },
        orderBy: { position: "asc" },
        include: {
          variants: {
            where: { active: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  return NextResponse.json(categories);
}
