import { prisma } from "@/lib/prisma";
import { CookingEventType, CookingStatus, EquipmentStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function NewCookingPage() {
  const lots = await prisma.lot.findMany({ orderBy: { createdAt: "desc" } });

  const ovens = await prisma.equipment.findMany({
    where: { type: "HORNO", active: true },
    orderBy: { name: "asc" },
  });

  async function createCooking(formData: FormData) {
    "use server";

    const lotId = formData.get("lotId") as string;
    const equipmentId = formData.get("equipmentId") as string;
    const agaveKg = Number(formData.get("agaveKg"));
    const notes = formData.get("notes") as string;

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

    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        status: EquipmentStatus.OPERANDO,
        currentLoad: agaveKg,
      },
    });

    redirect(`/cooking/${cooking.id}`);
  }

  return (
    <main className="mx-auto max-w-5xl p-8 text-white">
      <h1 className="text-4xl font-bold">Nueva Cocción</h1>

      <form action={createCooking} className="mt-8 space-y-6 rounded-2xl bg-slate-900 p-8">
        <div>
          <label className="mb-2 block">Lote</label>
          <select name="lotId" required className="w-full rounded-xl bg-slate-800 p-3">
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.code} — {lot.agaveKg.toLocaleString()} kg
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block">Horno</label>
          <select name="equipmentId" required className="w-full rounded-xl bg-slate-800 p-3">
            {ovens.map((oven) => (
              <option key={oven.id} value={oven.id}>
                {oven.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block">Kg de agave cargados</label>
          <input name="agaveKg" type="number" required className="w-full rounded-xl bg-slate-800 p-3" />
        </div>

        <div>
          <label className="mb-2 block">Observaciones</label>
          <textarea name="notes" rows={4} className="w-full rounded-xl bg-slate-800 p-3" />
        </div>

        <button className="rounded-xl bg-amber-400 px-8 py-3 font-bold text-black">
          Iniciar cocción
        </button>
      </form>
    </main>
  );
}