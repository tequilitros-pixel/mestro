import { prisma } from "@/lib/prisma";
import MainNav from "@/components/MainNav";
import { DistillationType } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function NewDistillationPage() {
  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "desc" },
  });

  const equipments = await prisma.equipment.findMany({
    where: {
      type: "ALAMBIQUE",
    },
    orderBy: {
      name: "asc",
    },
  });

  async function createDistillation(formData: FormData) {
    "use server";

    const lotId = formData.get("lotId") as string;
    const equipmentId = formData.get("equipmentId") as string;
    const type = formData.get("type") as DistillationType;
    const loadedLiters = Number(formData.get("loadedLiters"));
    const initialAlcoholRaw = formData.get("initialAlcohol");
    const initialAlcohol =
      initialAlcoholRaw && initialAlcoholRaw !== ""
        ? Number(initialAlcoholRaw)
        : null;

    const distillation = await prisma.distillation.create({
      data: {
        lotId,
        equipmentId,
        type,
        loadedLiters,
        initialAlcohol,
      },
    });

    redirect(`/distillation/${distillation.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-4xl">
        <MainNav />

        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">Nueva destilación</h1>

        <form
          action={createDistillation}
          className="mt-8 grid gap-5 rounded-2xl bg-slate-900 p-8"
        >
          <select name="lotId" required className="rounded-xl bg-slate-800 p-3">
            <option value="">Selecciona un lote</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.code}
              </option>
            ))}
          </select>

          <select
            name="equipmentId"
            required
            className="rounded-xl bg-slate-800 p-3"
          >
            <option value="">Selecciona un alambique</option>
            {equipments.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name}
              </option>
            ))}
          </select>

          <select name="type" required className="rounded-xl bg-slate-800 p-3">
            <option value="">Tipo de destilación</option>
            <option value="DESTROZADO">Destrozado</option>
            <option value="RECTIFICACION">Rectificación</option>
          </select>

          <input
            name="loadedLiters"
            type="number"
            step="0.01"
            placeholder="Litros cargados"
            required
            className="rounded-xl bg-slate-800 p-3"
          />

          <input
            name="initialAlcohol"
            type="number"
            step="0.01"
            placeholder="Alcohol inicial % (opcional)"
            className="rounded-xl bg-slate-800 p-3"
          />

          <button className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black">
            Crear destilación
          </button>
        </form>
      </div>
    </main>
  );
}