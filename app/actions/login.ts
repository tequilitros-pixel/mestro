"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function loginAction(formData: FormData) {
  const username = String(
    formData.get("username") ?? ""
  ).trim();

  const password = String(
    formData.get("password") ?? ""
  );

  if (!username || !password) {
    redirect("/login?error=1");
  }

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user || !user.active) {
    redirect("/login?error=1");
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password
  );

  if (!passwordMatches) {
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  cookieStore.set(
    "maestro_user",
    user.id,
    cookieOptions
  );

  cookieStore.set(
    "maestro_role",
    user.role,
    cookieOptions
  );

  if (user.role === "OPERATOR") {
    redirect("/cooking");
  }

  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();

  cookieStore.delete("maestro_user");
  cookieStore.delete("maestro_role");

  redirect("/login");
}