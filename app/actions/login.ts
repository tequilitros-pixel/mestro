"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user || !user.active) {
    redirect("/login?error=1");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();

  cookieStore.set("maestro_user", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  cookieStore.set("maestro_role", user.role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  if (user.role === "OPERATOR") {
    redirect("/cooking");
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();

  cookieStore.delete("maestro_user");
  cookieStore.delete("maestro_role");

  redirect("/login");
}
