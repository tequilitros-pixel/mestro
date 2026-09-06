import "server-only";

import type { User } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessModule } from "@/lib/permission-modules";

export async function canUserAccessModule(
  user: Pick<User, "id" | "role">,
  moduleKey: string,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;

  const permissions = await prisma.modulePermission.findMany({
    where: { userId: user.id },
    select: { moduleKey: true },
  });

  return canAccessModule(
    user.role,
    permissions.map((permission) => permission.moduleKey),
    moduleKey,
  );
}

export async function requireUserModuleAccess(moduleKey: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await canUserAccessModule(user, moduleKey))) redirect("/cooking");
  return user;
}
