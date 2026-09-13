"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createPersistentSession, destinationForUser, revokeCurrentSession } from "@/lib/session";
import { normalizeMexicanPhone } from "@/lib/phone";
import { clearAuthAttempts, consumeAuthAttempt, requestFingerprint } from "@/lib/authThrottle";

export async function loginAction(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rememberDevice = formData.get("rememberDevice") === "on";

  if (!identifier || !password) {
    redirect("/login?error=1");
  }

  const normalizedPhone = normalizeMexicanPhone(identifier);
  const fingerprint = await requestFingerprint();
  /*
   * A PROPOSITO en secuencia, no con Promise.all. Las dos llamadas abren una
   * transaccion SERIALIZABLE contra la misma tabla AuthThrottle; en paralelo
   * se bloquean entre si y Postgres aborta una con 40001 en cada intento de
   * acceso. Se siguen ejecutando LAS DOS (sin cortocircuito) para que ambos
   * contadores sigan sumando igual que antes.
   */
  const ipAllowed = await consumeAuthAttempt({
    scope: "login-ip",
    identifiers: [fingerprint],
    maxAttempts: 30,
    windowMs: 15 * 60_000,
  });
  const accountAllowed = await consumeAuthAttempt({
    scope: "login-account",
    identifiers: [fingerprint, identifier],
    maxAttempts: 10,
    windowMs: 15 * 60_000,
  });
  if (!ipAllowed || !accountAllowed) redirect("/login?error=locked");

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: identifier },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    },
  });

  if (!user || !user.active) {
    redirect("/login?error=1");
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user!.password
  );

  if (!passwordMatches) {
    redirect("/login?error=1");
  }

  await clearAuthAttempts("login-account", [fingerprint, identifier]);

  await createPersistentSession(user, rememberDevice);
  redirect(await destinationForUser(user));
}

export async function logoutAction() {
  await revokeCurrentSession();

  redirect("/login");
}
