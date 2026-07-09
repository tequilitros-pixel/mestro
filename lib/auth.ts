import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";


export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("maestro_user")?.value;

  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  return user;
}
