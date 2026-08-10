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

export async function getPersonnelById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      active: true,
      hourlyRate: true,
      pinHash: true,
      branches: { include: { branch: { select: { id: true, name: true } } } },
    },
  });

  if (!user) return null;

  // El hash del PIN nunca debe llegar al cliente — solo si tiene uno.
  const { pinHash, ...rest } = user;
  return { ...rest, hasPin: pinHash !== null };
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

  if (input.password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
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

interface UpdatePersonnelInput {
  userId: string;
  name: string;
  username: string;
  email?: string;
  role: UserRole;
  branchIds: string[];
  newPassword?: string;
}

export async function updatePersonnel(input: UpdatePersonnelInput) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return { error: "No tienes permiso para editar usuarios" };
  }

  if (input.newPassword && input.newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const existing = await prisma.user.findFirst({
    where: { username: input.username, NOT: { id: input.userId } },
  });
  if (existing) {
    return { error: "Ese nombre de usuario ya lo usa otro trabajador" };
  }

  const data: {
    name: string;
    username: string;
    email: string | undefined;
    role: UserRole;
    password?: string;
  } = {
    name: input.name,
    username: input.username,
    email: input.email || undefined,
    role: input.role,
  };

  if (input.newPassword) {
    data.password = await bcrypt.hash(input.newPassword, 10);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: input.userId }, data }),
    prisma.userBranch.deleteMany({ where: { userId: input.userId } }),
    prisma.userBranch.createMany({
      data: input.branchIds.map((branchId) => ({
        userId: input.userId,
        branchId,
      })),
    }),
  ]);

  revalidatePath("/administration/personnel");
  revalidatePath(`/administration/personnel/${input.userId}`);

  return { success: true };
}

export async function updateHourlyRate(userId: string, hourlyRate: number | null) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  if (hourlyRate !== null && hourlyRate < 0) {
    return { error: "La tarifa no puede ser negativa" };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { hourlyRate },
    });

    // Cierra la tarifa por hora vigente (si había) y abre una nueva,
    // para que la nómina de semanas pasadas siga usando lo que se
    // pagaba entonces aunque el sueldo cambie hoy.
    await tx.salaryRate.updateMany({
      where: { userId, scheme: "HORA", effectiveTo: null },
      data: { effectiveTo: now },
    });

    if (hourlyRate !== null) {
      await tx.salaryRate.create({
        data: {
          userId,
          scheme: "HORA",
          amount: hourlyRate,
          effectiveFrom: now,
          createdById: currentUser.id,
        },
      });
    }
  });

  revalidatePath("/administration/personnel");
  revalidatePath(`/administration/personnel/${userId}`);

  return { success: true };
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
