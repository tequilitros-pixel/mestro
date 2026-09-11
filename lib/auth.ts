import "server-only";
import { cookies } from "next/headers";
import { rawPrisma as prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { hashSessionToken } from "@/lib/session";
import {
  LEGACY_OPERATOR_PERMISSION_KEYS,
  isConfigurablePermissionKey,
  isAdminOnlyPath,
} from "@/lib/permission-modules";



export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("maestro_session")?.value;

  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  return session;
}
export async function getCurrentUser() {
  return (await getCurrentSession())?.user ?? null;
}
export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    // /cooking puede requerir un permiso que el usuario no tenga y provocar
    // un ciclo de redirecciones. El perfil es un destino autenticado seguro.
    redirect(user ? "/profile" : "/login");
  }

  return user;
}

export async function requireAdminAction() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("PERMISSION_DENIED");
  return user;
}

export async function requireModuleActionAccess(moduleKey: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("PERMISSION_DENIED");
  if (user.role === "ADMIN") return user;

  const permission = await prisma.modulePermission.findUnique({
    where: { userId_moduleKey: { userId: user.id, moduleKey } },
    select: { id: true },
  });
  if (!permission) throw new Error("PERMISSION_DENIED");
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

  if (isAdminOnlyPath(moduleKey)) redirect("/profile");

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

  if (!permission) redirect("/profile");

  return user;
}
export async function getAccessibleBranchIds(): Promise<string[] | null> {
  const user = await getCurrentUser();

  if (!user) return [];

  if (user.role === "ADMIN") {
    return null;
  }

  // Authentication uses the raw client, but branch membership is RLS-protected.
  const { withRlsContext } = await import("@/lib/rls");
  const branches = await withRlsContext(user, (tx) => tx.userBranch.findMany({
    where: { userId: user.id },
    select: { branchId: true },
  }));

  return branches.map((b) => b.branchId);
}
