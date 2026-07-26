"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export async function getPersonnel() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      active: true,
      branches: { include: { branch: { select: { id: true, name: true } } } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getBranchesForAssignment() {
  return prisma.branch.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

interface CreatePersonnelInput {
  name: string;
  username: string;
  email?: string;
  password: string;
  role: UserRole;
  branchIds: string[];
}

export async function createPersonnel(input: CreatePersonnelInput) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return { error: "No tienes permiso para crear usuarios" };
  }

  const existing = await prisma.user.findUnique({
    where: { username: input.username },
  });
  if (existing) {
    return { error: "Ese nombre de usuario ya existe" };
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      email: input.email || undefined,
      password: hashedPassword,
      role: input.role,
      branches: {
        create: input.branchIds.map((branchId) => ({ branchId })),
      },
    },
  });

  revalidatePath("/administration/personnel");
  return { user };
}

export async function updatePersonnelActive(userId: string, active: boolean) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/administration/personnel");
  return { success: true };
}
