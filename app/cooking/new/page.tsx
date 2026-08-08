import { prisma } from "@/lib/prisma";
import { CookingEventType, CookingStatus, LotStage } from "@prisma/client";
import { redirect } from "next/navigation";
import { advanceLotStage } from "@/lib/lotStage";
import { findAvailableEquipment, reserveEquipment } from "@/lib/equipmentAvailability";

export default async function NewCookingPage() {
  /*
   * Solo lotes que todavía pueden entrar al horno. Un lote ya
   * molido, fermentado o terminado no debe aparecer: antes salían
   * todos y se podía arrancar una cocción sobre un lote cerrado.
   */
  const lots = await prisma.lot.findMany({
    where: { stage: { in: [LotStage.RECEPCION, LotStage.COCCION] } },
    orderBy: { createdAt: "desc" },
  });

  const ovens = await findAvailableEquipment(["HORNO"]);

  async function createCooking(formData: FormData) {
    "use server";

    const lotId = formData.get("lotId") as string;
    const equipmentId = formData.get("equipmentId") as string;
    const agaveKg = Number(formData.get("agaveKg"));
    const notes = formData.get("notes") as string;

    // Se reserva el horno ANTES de crear la cocción: si alguien más
    // lo tomó mientras este formulario estaba abierto, no se crea
    // nada y se regresa al listado en vez de dejar dos lotes en el
    // mismo equipo.
    const reserved = await reserveEquipment(prisma, equipmentId, agaveKg);

    if (!reserved) {
      redirect("/cooking/new?error=equipo-ocupado");
    }

    const cooking = await prisma.cooking.create({
      data: {
        lotId,
        equipmentId,
        agaveKg,
        status: CookingStatus.ACTIVA,
        notes,
        events: {
          create: {
            type: CookingEventType.INICIO_COCCION,
            notes: "Inicio de cocción",
          },
        },
      },
    });

    await advanceLotStage(prisma, lotId, LotStage.COCCION);

    redirect(`/cooking/${cooking.id}`);
  }

  const blockers: string[] = [];

  if (lots.length === 0) {
    blockers.push(
      "No hay lotes en recepción o cocción. Crea un lote nuevo antes de iniciar el horno.",
    );
  }

  if (ovens.length === 0) {
    blockers.push(
      "Todos los hornos están ocupados o fuera de servicio. Cierra la cocción en curso para liberar uno.",
    );
  }

  if (blockers.length > 0) {
    return (
      <main className="mx-auto max-w-5xl p-8 text-on-surface">
        <h1 className="text-4xl font-bold">Nueva Cocción</h1>

        <div className="mt-8 space-y-3 rounded-2xl border border-secondary/30 bg-secondary/10 p-8">
          <h2 className="text-xl font-bold text-secondary">
            Todavía no se puede iniciar una cocción
          </h2>

          {blockers.map((blocker) => (
            <p key={blocker} className="text-sm text-on-surface-variant">
              {blocker}
            </p>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8 text-on-surface">
      <h1 className="text-4xl font-bold">Nueva Cocción</h1>

      <form action={createCooking} className="mt-8 space-y-6 rounded-2xl bg-surface-container p-8">
        <div>
          <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Lote</label>
          <select name="lotId" required className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.code} — {lot.agaveKg.toLocaleString()} kg
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Horno</label>
          <select name="equipmentId" required className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
            {ovens.map((oven) => (
              <option key={oven.id} value={oven.id}>
                {oven.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Kg de agave cargados</label>
          <input name="agaveKg" type="number" required className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Observaciones</label>
          <textarea name="notes" rows={4} className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" />
        </div>

        <button className="rounded-xl bg-primary px-8 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]">
          Iniciar cocción
        </button>
      </form>
    </main>
  );
}