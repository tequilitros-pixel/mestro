import "server-only";
import { Prisma, type WorkforcePolicyVersion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LEGAL_FIELDS, assertWorkforcePolicy, type EditableWorkforcePolicy } from "./rules";

type Db = Prisma.TransactionClient | typeof prisma;

export async function resolveWorkforcePolicy(at: Date, db: Db = prisma) {
  const policy = await db.workforcePolicyVersion.findFirst({
    where: { effectiveFrom: { lte: at } },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });
  if (!policy) throw new Error("WORKFORCE_POLICY_MISSING");
  return policy;
}

export async function listWorkforcePolicies() {
  return prisma.workforcePolicyVersion.findMany({
    include: { changedBy: { select: { id: true, name: true, username: true } } },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });
}

function legalChanged(current: WorkforcePolicyVersion, input: EditableWorkforcePolicy) {
  return LEGAL_FIELDS.some((field) => current[field] !== input[field]);
}

export async function createWorkforcePolicyVersion(
  actor: { id: string; role: string },
  input: EditableWorkforcePolicy & {
    effectiveFrom: Date;
    reason: string;
    confirmLegalChange: boolean;
  },
) {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  assertWorkforcePolicy(input);
  if (Number.isNaN(input.effectiveFrom.getTime())) throw new Error("Fecha efectiva inválida.");
  if (input.reason.trim().length < 5) throw new Error("La razón del cambio es obligatoria.");
  return prisma.$transaction(
    async (tx) => {
      const current = await resolveWorkforcePolicy(input.effectiveFrom, tx);
      const criticalLegalChange = legalChanged(current, input);
      if (criticalLegalChange && (!input.confirmLegalChange || input.reason.trim().length < 10))
        throw new Error("El cambio legal requiere confirmación explícita y una razón detallada.");
      const duplicateDate = await tx.workforcePolicyVersion.findUnique({
        where: { effectiveFrom: input.effectiveFrom },
      });
      if (duplicateDate) throw new Error("Ya existe una versión para esa fecha efectiva.");
      const latest = await tx.workforcePolicyVersion.findFirst({ orderBy: { version: "desc" } });
      const version = (latest?.version ?? 0) + 1;
      const { effectiveFrom, reason, confirmLegalChange: _confirmation, ...values } = input;
      void _confirmation;
      return tx.workforcePolicyVersion.create({
        data: {
          ...values,
          effectiveFrom,
          version,
          legalPolicyCode: criticalLegalChange
            ? `MX_OVERTIME_CUSTOM_V${version}`
            : current.legalPolicyCode,
          changedById: actor.id,
          changeReason: reason.trim(),
          criticalLegalChange,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    },
  );
}
