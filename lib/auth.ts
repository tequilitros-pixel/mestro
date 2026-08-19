import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { hashSessionToken } from "@/lib/session";
import {
  LEGACY_OPERATOR_PERMISSION_KEYS,
  isConfigurablePermissionKey,
} from "@/lib/permission-modules";



export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("maestro_session")?.value;

  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  return session.user;
}
export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/cooking");
  }

  return user;
}
export async function requireModuleAccess(moduleKey: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "ADMIN") {
    return user;
  }

  if (user.role === "OPERATOR") {
    const storedPermissions = await prisma.modulePermission.findMany({
      where: { userId: user.id },
      select: { moduleKey: true },
    });
    const hasConfiguredPermissions = storedPermissions.some((permission) =>
      isConfigurablePermissionKey(permission.moduleKey),
    );

    if (
      !hasConfiguredPermissions &&
      LEGACY_OPERATOR_PERMISSION_KEYS.some((key) => key === moduleKey)
    ) {
      return user;
    }
  }

  const permission = await prisma.modulePermission.findUnique({
    where: { userId_moduleKey: { userId: user.id, moduleKey } },
  });

  if (!permission) {
    redirect("/cooking");
  }

  return user;
}
export async function getAccessibleBranchIds(): Promise<string[] | null> {
  const user = await getCurrentUser();

  if (!user) return [];

  if (user.role === "ADMIN") {
    return null;
  }

  const branches = await prisma.userBranch.findMany({
    where: { userId: user.id },
    select: { branchId: true },
  });

  return branches.map((b) => b.branchId);
}
