import { prisma } from "@/lib/prisma";
import NewCountForm from "./NewCountForm";

export default async function NewCountPage() {
  const branches = await prisma.branch.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-lg space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Nuevo conteo</h1>
          <p className="mt-3 text-on-surface-variant">
            Se abrirá una lista con todos los productos activos para capturar existencias.
          </p>
        </div>

        <NewCountForm branches={branches} />
      </div>
    </main>
  );
}
