import "server-only";
import type { FinancialMovementDirection, FinancialMovementScope, Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function requireFinancialMovementCategory(
  db: Db,
  input: { categoryId: unknown; direction: FinancialMovementDirection; scope: FinancialMovementScope },
) {
  if (typeof input.categoryId !== "string" || !input.categoryId.trim()) {
    throw new DomainError("VALIDATION_ERROR", { field: "categoryId" });
  }
  const category = await db.financialMovementCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new DomainError("VALIDATION_ERROR", { field: "categoryId", reason: "NOT_FOUND" });
  if (!category.isActive) throw new DomainError("VALIDATION_ERROR", { field: "categoryId", reason: "INACTIVE" });
  if (category.direction !== input.direction) throw new DomainError("VALIDATION_ERROR", { field: "categoryId", reason: "WRONG_DIRECTION" });
  if (category.scope !== input.scope && category.scope !== "BOTH") throw new DomainError("VALIDATION_ERROR", { field: "categoryId", reason: "WRONG_SCOPE" });
  return category;
}

export function categoryCode(name: string) {
  const code = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return code || "CATEGORY";
}
