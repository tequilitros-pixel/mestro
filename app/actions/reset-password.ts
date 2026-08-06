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

  // Se busca el código vigente del usuario (sin filtrar por el código
  // capturado) para poder contar intentos fallidos contra ese mismo
  // registro, sin importar qué código haya escrito el usuario. Así
  // evitamos que alguien intente adivinar el código de 6 dígitos por
  // fuerza bruta: después de MAX_ATTEMPTS intentos fallidos el código
  // se invalida y hay que pedir uno nuevo.
  const MAX_ATTEMPTS = 5;

  const resetCode = await prisma.passwordResetCode.findFirst({
    where: {
      userId: user!.id,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!resetCode) {
    backToForm();
  }

  if (resetCode!.attempts >= MAX_ATTEMPTS) {
    await prisma.passwordResetCode.update({
      where: { id: resetCode!.id },
      data: { used: true },
    });
    backToForm();
  }

  if (resetCode!.code !== code) {
    await prisma.passwordResetCode.update({
      where: { id: resetCode!.id },
      data: { attempts: { increment: 1 } },
    });
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
