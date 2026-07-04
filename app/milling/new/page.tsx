import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NewMillingPage() {
  const lots = await prisma.lot.findMany({
    where: {
      stage: {
        in: ["COCCION", "MOLIENDA", "RECEPCION"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const equipments = await prisma.equipment.findMany({
    where: {
      type: {
        in: ["DESGARRADORA", "PRENSA"],
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  async function createMilling(formData: FormData) {
    "use server";

    const lotId = formData.get("lotId") as string;
    const equipmentId = formData.get("equipmentId") as string;
    const cookedKg = Number(formData.get("cookedKg"));

    const milling = await prisma.milling.create({
      data: {
        lotId,
        equipmentId,
        cookedKg,
      },
    });

    redirect(`/milling/${milling.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-2 mb-8 text-4xl font-bold">
          Nueva molienda
        </h1>

        <form action={createMilling} className="space-y-6">

          <div>
            <label className="mb-2 block">Lote</label>

            <select
              name="lotId"
              required
              className="w-full rounded-xl bg-slate-800 p-3"
            >
              <option value="">Selecciona un lote</option>

              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block">Equipo</label>

            <select
              name="equipmentId"
              required
              className="w-full rounded-xl bg-slate-800 p-3"
            >
              <option value="">Selecciona un equipo</option>

              {equipments.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block">Kg cocidos</label>

            <input
              type="number"
              step="0.01"
              name="cookedKg"
              required
              className="w-full rounded-xl bg-slate-800 p-3"
            />
          </div>

          <button className="w-full rounded-xl bg-amber-400 py-3 font-bold text-black">
            Iniciar molienda
          </button>

        </form>
      </div>
    </main>
  );
}