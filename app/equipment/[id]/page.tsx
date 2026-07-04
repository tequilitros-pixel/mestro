import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { EquipmentStatus } from "@prisma/client";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EquipmentPage({ params }: Props) {
  const { id } = await params;

  const equipment = await prisma.equipment.findUnique({
    where: { id },
  });

  if (!equipment) {
    notFound();
  }

  async function updateEquipment(formData: FormData) {
    "use server";

    const status = formData.get("status") as EquipmentStatus;
    const currentLoad = Number(formData.get("currentLoad"));
    const location = formData.get("location") as string;

    await prisma.equipment.update({
      where: { id },
      data: {
        status,
        currentLoad,
        location,
      },
    });

    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">{equipment.name}</h1>

        <form
          action={updateEquipment}
          className="mt-8 space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-8"
        >
          <div>
            <label className="block text-sm text-slate-400">Estado</label>
            <select
              name="status"
              defaultValue={equipment.status}
              className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-white"
            >
              <option value="DISPONIBLE">DISPONIBLE</option>
              <option value="OPERANDO">OPERANDO</option>
              <option value="ESPERANDO">ESPERANDO</option>
              <option value="LAVADO">LAVADO</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400">
              Carga actual ({equipment.unit})
            </label>
            <input
              name="currentLoad"
              type="number"
              defaultValue={equipment.currentLoad}
              className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400">Ubicación</label>
            <input
              name="location"
              type="text"
              defaultValue={equipment.location ?? ""}
              className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-white"
            />
          </div>

          <div className="rounded-xl bg-slate-800 p-4">
            <p className="text-sm text-slate-400">Capacidad</p>
            <p className="text-xl font-semibold">
              {equipment.capacity} {equipment.unit}
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300"
          >
            Guardar cambios
          </button>
        </form>
      </div>
    </main>
  );
}