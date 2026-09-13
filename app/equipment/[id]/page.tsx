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
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">{equipment.name}</h1>

        <form
          action={updateEquipment}
          className="mt-8 space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-8"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Estado</label>
            <select
              name="status"
              defaultValue={equipment.status}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="DISPONIBLE">DISPONIBLE</option>
              <option value="OPERANDO">OPERANDO</option>
              <option value="ESPERANDO">ESPERANDO</option>
              <option value="LAVADO">LAVADO</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
              Carga actual ({equipment.unit})
            </label>
            <input
              name="currentLoad"
              type="number"
              defaultValue={equipment.currentLoad}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">Ubicación</label>
            <input
              name="location"
              type="text"
              defaultValue={equipment.location ?? ""}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </div>

          <div className="rounded-xl bg-surface-container-high p-4">
            <p className="text-sm text-on-surface-variant">Capacidad</p>
            <p className="text-xl font-semibold">
              {equipment.capacity} {equipment.unit}
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Guardar cambios
          </button>
        </form>
      </div>
    </main>
  );
}