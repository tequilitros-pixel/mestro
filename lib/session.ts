import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getDefaultPathForModuleKeys, isConfigurablePermissionKey } from "@/lib/permission-modules";

export async function createPersistentSession(
  user: { id: string; role: string },
  rememberDevice = true
) {
  const token = randomBytes(32).toString("base64url");
  const maxAge = rememberDevice ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  await prisma.userSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  });

  const cookieStore = await cookies();
  const options: Parameters<typeof cookieStore.set>[2] = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  if (rememberDevice) options.maxAge = maxAge;
  cookieStore.set("maestro_session", token, options);
  cookieStore.delete("maestro_user");
  cookieStore.delete("maestro_role");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("maestro_session")?.value;
  if (token) {
    await prisma.userSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  cookieStore.delete("maestro_session");
  cookieStore.delete("maestro_user");
  cookieStore.delete("maestro_role");
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.userSession.deleteMany({ where: { userId } });
}

export async function destinationForUser(user: { id: string; role: string }) {
  if (user.role === "ADMIN") return "/";
  const permissions = await prisma.modulePermission.findMany({
    where: { userId: user.id },
    select: { moduleKey: true },
  });
  const keys = permissions.map((item) => item.moduleKey).filter(isConfigurablePermissionKey);
  if (user.role === "OPERATOR" && keys.length === 0) return "/cooking";
  return getDefaultPathForModuleKeys(keys);
}
