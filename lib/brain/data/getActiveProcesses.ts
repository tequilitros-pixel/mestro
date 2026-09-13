import { prisma } from "@/lib/prisma";

export async function getActiveProcesses() {
  const [cookings, millings, fermentations, distillations] =
    await Promise.all([
      prisma.cooking.findMany({
        where: { status: "ACTIVA" },
        include: {
          equipment: true,
          lot: true,
          events: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),

      prisma.milling.findMany({
        where: { status: "ACTIVA" },
        include: {
          equipment: true,
          lot: true,
          events: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),

      prisma.fermentation.findMany({
        where: { status: "ACTIVA" },
        include: {
          lot: true,
          readings: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),

      prisma.distillation.findMany({
        where: { status: "ACTIVA" },
        include: {
          equipment: true,
          lot: true,
          events: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),
    ]);

  return { cookings, millings, fermentations, distillations };
}
