import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { MetricCard, PageHeader } from "@/components/ui/CompactUI";

export default async function LiquorProductionPage() {
  const batches = await prisma.liquorBatch.findMany({ orderBy: { createdAt: "desc" }, include: { product: true, recipe: true, steps: { select: { status: true, title: true } } } });
  const active = batches.filter((item) => item.status !== "TERMINADO");
  const volume = active.reduce((total, item) => total + (item.actualLiters ?? item.plannedLiters), 0);
  const finished = batches.filter((item) => item.status === "TERMINADO").length;
  const alerts = active.filter((item) => item.qualityStatus === "RECHAZADO" || item.pausedAt).length;
  return (
    <main className="page-frame space-y-4 text-on-surface">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Producción de licores"
          description="Control de lotes, pasos y avance de elaboración."
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/liquors/recipes"
                className="compact-action inline-flex items-center border border-outline-variant font-semibold text-on-surface hover:bg-surface-container-high"
              >
                Recetas
              </Link>
              <Link
                href="/liquors"
                className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary"
              >
                Nueva producción
              </Link>
            </div>
          }
        />

        <div className="flex gap-1 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container p-1">
          <Link href="/liquors/production" className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Proceso de elaboración</Link>
          <Link href="/liquors/production/labels" className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high">Crear etiquetas</Link>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Producciones activas" value={active.length} />
          <MetricCard
            label="Volumen en proceso"
            value={`${volume.toLocaleString("es-MX")} L`}
          />
          <MetricCard
            label="Producciones terminadas"
            value={finished}
            tone="success"
          />
          <MetricCard
            label="Con alerta"
            value={alerts}
            tone={alerts ? "warning" : "neutral"}
          />
        </section>

        <ProcessTable
          emptyLabel="No hay producciones registradas."
          columns={[
            { key: "code", label: "Código de lote", width: "14%" },
            { key: "product", label: "Producto", width: "14%" },
            { key: "recipe", label: "Receta", width: "14%" },
            { key: "volume", label: "Volumen", width: "10%" },
            { key: "startedAt", label: "Inicio", width: "13%" },
            { key: "step", label: "Paso actual", width: "15%" },
            { key: "progress", label: "Avance", width: "10%" },
            { key: "status", label: "Estado", width: "10%" },
          ]}
          filters={[
            {
              key: "product",
              label: "Producto",
              options: [...new Set(batches.map((item) => item.product.name))],
            },
            {
              key: "step",
              label: "Paso actual",
              options: [
                ...new Set(
                  batches.flatMap((item) =>
                    item.steps
                      .filter((step) => step.status !== "COMPLETADO")
                      .map((step) => step.title)
                  )
                ),
              ],
            },
          ]}
          rows={batches.map((item) => {
            const done = item.steps.filter(
              (step) => step.status === "COMPLETADO"
            ).length;
            const current =
              item.steps.find((step) => step.status !== "COMPLETADO")?.title ??
              "—";
            const progress = item.steps.length
              ? Math.round((done / item.steps.length) * 100)
              : 0;

            return {
              id: item.id,
              href: `/liquors/batches/${item.id}`,
              code: item.code,
              search: `${item.code} ${item.product.name} ${item.recipe.name}`,
              startedAt: (item.startedAt ?? item.productionDate).toISOString(),
              status:
                item.status === "TERMINADO" ? "Terminado" : "En proceso",
              finished: item.status === "TERMINADO",
              values: {
                product: item.product.name,
                recipe: item.recipe.name,
                volume: `${item.actualLiters ?? item.plannedLiters} L`,
                step: current,
                progress: `${progress}%`,
              },
              filters: { product: item.product.name, step: current },
            };
          })}
        />
      </div>
    </main>
  );
}
