"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeMexicanPhone } from "@/lib/phone";
import { checkSmsCode, sendSmsCode } from "@/lib/twilioVerify";
import { createPersistentSession, destinationForUser } from "@/lib/session";
import { consumeAuthAttempt, requestFingerprint } from "@/lib/authThrottle";

export async function requestSmsLoginCode(phoneInput: string) {
  const phone = normalizeMexicanPhone(phoneInput);
  if (!phone) return { error: "Escribe un número mexicano de 10 dígitos." };
  const fingerprint = await requestFingerprint();
  const allowed = await consumeAuthAttempt({
    scope: "sms-send",
    identifiers: [fingerprint, phone],
    maxAttempts: 3,
    windowMs: 15 * 60_000,
  });
  if (!allowed) return { error: "Espera unos minutos antes de solicitar otro código." };
  const user = await prisma.user.findUnique({ where: { phone }, select: { active: true } });
  if (!user?.active) return { success: true, phone };
  try {
    await sendSmsCode(phone);
    return { success: true, phone };
  } catch (error) {
    console.error("SMS verification send failed", error);
    return { error: "No pudimos enviar el código. Revisa el número e intenta nuevamente." };
  }
}

export async function verifySmsLoginCode(phoneInput: string, codeInput: string) {
  const phone = normalizeMexicanPhone(phoneInput);
  const code = codeInput.replace(/\D/g, "");
  if (!phone || code.length < 4) return { error: "El código no es válido." };
  const fingerprint = await requestFingerprint();
  const allowed = await consumeAuthAttempt({
    scope: "sms-check",
    identifiers: [fingerprint, phone],
    maxAttempts: 8,
    windowMs: 15 * 60_000,
  });
  if (!allowed) return { error: "Demasiados intentos. Espera unos minutos." };
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user?.active) return { error: "No fue posible iniciar sesión." };
  try {
    const verification = await checkSmsCode(phone, code);
    if (verification.status !== "approved") return { error: "Código incorrecto o vencido." };
  } catch (error) {
    console.error("SMS verification check failed", error);
    return { error: "Código incorrecto o vencido." };
  }
  await createPersistentSession(user);
  redirect(await destinationForUser(user));
}
