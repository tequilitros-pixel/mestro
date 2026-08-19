"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createPersistentSession, revokeAllUserSessions } from "@/lib/session";

export async function changePasswordAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/profile?error=campos");
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);

  if (!passwordMatches) {
    redirect("/profile?error=actual");
  }

  if (newPassword !== confirmPassword) {
    redirect("/profile?error=confirmacion");
  }

  if (newPassword.length < 8) {
    redirect("/profile?error=corta");
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  await revokeAllUserSessions(user.id);
  await createPersistentSession(user, false);

  redirect("/profile?success=1");
}
