import { prisma } from "@/lib/prisma";
import NewEventForm from "./NewEventForm";

export default async function NewEventPage() {
  const [packages, kits] = await Promise.all([
    prisma.eventPackage.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.equipmentKit.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Nuevo evento</h1>
          <p className="mt-3 text-on-surface-variant">
            Al elegir un paquete y una modalidad, se genera el checklist automáticamente.
          </p>
        </div>

        <NewEventForm packages={packages} kits={kits} />
      </div>
    </main>
  );
}
