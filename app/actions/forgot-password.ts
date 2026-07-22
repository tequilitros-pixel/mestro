"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=1");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // No revelamos si el correo existe o no: siempre
  // avanzamos a la misma pantalla para evitar que alguien
  // use este formulario para adivinar correos válidos.
  if (user && user.active) {
    const code = generateCode();

    // Invalida cualquier código anterior sin usar
    await prisma.passwordResetCode.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    await prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await sendPasswordResetEmail(email, code);
  }

  redirect(
    `/reset-password?email=${encodeURIComponent(email)}`
  );
}
