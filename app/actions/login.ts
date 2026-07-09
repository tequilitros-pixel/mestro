"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user || !user.active || user.password !== password) {
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();

  cookieStore.set("maestro_user", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/dashboard");
}