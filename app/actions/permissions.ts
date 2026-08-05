"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function getUserModuleKeys(userId: string): Promise<string[]> {
  const permissions = await prisma.modulePermission.findMany({
    where: { userId },
    select: { moduleKey: true },
  });

  return permissions.map((p) => p.moduleKey);
}

export async function setModulePermissionAction(
  userId: string,
  moduleKey: string,
  granted: boolean,
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "ADMIN") {
    return { success: false, error: "No tienes permiso para hacer esto." };
  }

  try {
    if (granted) {
      await prisma.modulePermission.upsert({
        where: { userId_moduleKey: { userId, moduleKey } },
        update: {},
        create: { userId, moduleKey },
      });
    } else {
      await prisma.modulePermission.deleteMany({
        where: { userId, moduleKey },
      });
    }

    revalidatePath(`/administration/personnel/${userId}/permissions`);

    return { success: true };
  } catch (error) {
    console.error("Error setting module permission:", error);
    return { success: false, error: "No fue posible actualizar el permiso." };
  }
}

export async function setGroupPermissionAction(
  userId: string,
  moduleKeys: string[],
  granted: boolean,
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "ADMIN") {
    return { success: false, error: "No tienes permiso para hacer esto." };
  }

  try {
    if (granted) {
      await prisma.$transaction(
        moduleKeys.map((moduleKey) =>
          prisma.modulePermission.upsert({
            where: { userId_moduleKey: { userId, moduleKey } },
            update: {},
            create: { userId, moduleKey },
          }),
        ),
      );
    } else {
      await prisma.modulePermission.deleteMany({
        where: { userId, moduleKey: { in: moduleKeys } },
      });
    }

    revalidatePath(`/administration/personnel/${userId}/permissions`);

    return { success: true };
  } catch (error) {
    console.error("Error setting group permission:", error);
    return { success: false, error: "No fue posible actualizar los permisos." };
  }
}
