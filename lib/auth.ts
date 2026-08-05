import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";



export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("maestro_user")?.value;

  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  return user;
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
