"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function resetPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(
    formData.get("confirmPassword") ?? ""
  );

  const backToForm = () =>
    redirect(
      `/reset-password?email=${encodeURIComponent(email)}&error=1`
    );

  if (!email || !code || !password || !confirmPassword) {
    backToForm();
  }

  if (password !== confirmPassword) {
    backToForm();
  }

  if (password.length < 8) {
    backToForm();
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.active) {
    backToForm();
  }

  const resetCode = await prisma.passwordResetCode.findFirst({
    where: {
      userId: user!.id,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!resetCode) {
    backToForm();
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user!.id },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetCode.update({
      where: { id: resetCode!.id },
      data: { used: true },
    }),
  ]);

  redirect("/login?reset=1");
}
