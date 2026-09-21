import { prisma } from "../lib/prisma";
import { buildAutomaticEnvelopeReceipt } from "../lib/cash-cuts/envelopeReceipt";

const apply = process.argv.includes("--apply");

async function main() {
  const pending = await prisma.cashSafeEnvelope.findMany({
    where: { status: "PENDIENTE" },
    select: {
      id: true,
      code: true,
      cashCutId: true,
      originalAmount: true,
      createdById: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const total = pending.reduce((sum, envelope) => sum + envelope.originalAmount, 0);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", count: pending.length, total }));
  if (!apply || pending.length === 0) return;

  const received = await prisma.$transaction(
    async (tx) => {
      let count = 0;

      for (const envelope of pending) {
        const receipt = buildAutomaticEnvelopeReceipt({
          amount: envelope.originalAmount,
          userId: envelope.createdById,
          cashCutId: envelope.cashCutId,
          notes: "Recepción automática al habilitar el flujo directo a caja fuerte",
        });
        const updated = await tx.cashSafeEnvelope.updateMany({
          where: { id: envelope.id, status: "PENDIENTE" },
          data: {
            currentBalance: envelope.originalAmount,
            ...receipt.envelope,
          },
        });
        if (updated.count === 0) continue;

        await tx.cashSafeEnvelopeMovement.create({
          data: {
            envelopeId: envelope.id,
            ...receipt.movement,
          },
        });
        count += 1;
      }

      return count;
    },
    { isolationLevel: "Serializable" },
  );

  console.log(JSON.stringify({ received }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
