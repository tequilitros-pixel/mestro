import "server-only";
import bcrypt from "bcryptjs";
import { Prisma, type UserRole } from "@prisma/client";
import { normalizeMexicanPhone } from "@/lib/phone";

export type CreateUserRecordInput = {
  name: string;
  username: string;
  password: string;
  role: UserRole;
  email?: string | null;
  phone?: string | null;
  branchIds?: string[];
};

/** Canonical User creation shared by Personnel and Workforce onboarding. */
export async function createUserRecord(
  tx: Prisma.TransactionClient,
  input: CreateUserRecordInput,
) {
  const name = input.name.trim();
  const username = input.username.trim();
  if (!name || !username) throw new Error("Nombre y usuario son obligatorios.");
  if (input.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  const phone = input.phone?.trim() ? normalizeMexicanPhone(input.phone) : null;
  if (input.phone?.trim() && !phone) throw new Error("El teléfono debe tener 10 dígitos.");
  const duplicate = await tx.user.findFirst({
    where: { OR: [{ username }, ...(phone ? [{ phone }] : [])] },
    select: { username: true, phone: true },
  });
  if (duplicate?.username === username) throw new Error("Ese nombre de usuario ya existe.");
  if (phone && duplicate?.phone === phone) throw new Error("Ese teléfono ya está registrado.");

  return tx.user.create({
    data: {
      name,
      username,
      email: input.email?.trim() || null,
      phone,
      password: await bcrypt.hash(input.password, 10),
      role: input.role,
      branches: {
        create: [...new Set(input.branchIds ?? [])].map((branchId) => ({ branchId })),
      },
    },
  });
}
