import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GearIcon } from "@/components/ui/icons";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function LiquorProductPage({
  params,
}: Props) {
  const { slug } = await params;

  const product = await prisma.liquorProduct.findUnique({
    where: {
      slug,
    },
    include: {
      recipes: {
        where: {
          active: true,
        },
        include: {
          ingredients: {
            orderBy: {
              position: "asc",
            },
          },
        },
        orderBy: {
          version: "desc",
        },
      },
      batches: {
        include: {
          recipe: true,
          bottlings: {
            select: {
              producedBottles: true,
              rejectedBottles: true,
            },
          },
        },
        orderBy: {
          productionDate: "desc",
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const activeRecipe = product.recipes[0] ?? null;

  const totalPlannedLiters = product.batches.reduce(
    (sum, batch) => sum + batch.plannedLiters,
    0
  );

  const totalActualLiters = product.batches.reduce(
    (sum, batch) => sum + Number(batch.actualLiters ?? 0),
    0
  );

  const totalBottles = product.batches.reduce(
    (batchTotal, batch) =>
      batchTotal +
      batch.bottlings.reduce(
        (bottlingTotal, bottling) =>
          bottlingTotal + bottling.producedBottles,
        0
      ),
    0
  );

  const lastBatch = product.batches[0] ?? null;

  return (
    <section className="mx-auto max-w-7xl">
      <Link
        href="/liquors"
        className="text-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
      >
        ← Regresar al catálogo
      </Link>

      <header className="mt-6 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-outline-variant bg-surface-container-high text-5xl">
              {product.icon ?? "🍹"}
            </div>

            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.35em] text-on-surface-variant">
                Elaboración de Licores
              </p>

              <h1 className="mt-3 text-4xl font-black text-on-surface sm:text-5xl">
                {product.name}
              </h1>

              <p className="mt-3 max-w-2xl text-on-surface-variant">
                {product.description ??
                  `Historial completo de ${product.name} de Destiladora del Norte.`}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
  <Link
    href={`/liquors/products/${product.slug}/edit`}
    className="flex items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-background px-6 py-4 text-center font-bold text-on-surface transition duration-150 ease-out hover:border-primary/25 hover:text-on-surface hover:scale-[1.04] active:scale-[0.97]"
  >
    <GearIcon className="h-4 w-4" />
    Configurar producto
  </Link>

  {activeRecipe ? (
    <Link
      href={`/liquors/products/${product.slug}/new`}
      className="rounded-2xl bg-primary px-6 py-4 text-center font-bold text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
    >
      {product.icon ?? "🍹"} Elaborar {product.name}
    </Link>
  ) : (
    <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-5 py-4 text-sm text-secondary">
      Primero debemos registrar la receta oficial.
    </div>
  )}
</div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Lotes elaborados"
          value={product.batches.length}
          detail="Historial total"
        />

        <Kpi
          title="Litros elaborados"
          value={`${formatNumber(totalActualLiters || totalPlannedLiters)} L`}
          detail={
            totalActualLiters > 0
              ? "Volumen real acumulado"
              : "Volumen planeado acumulado"
          }
        />

        <Kpi
          title="Botellas producidas"
          value={formatNumber(totalBottles, 0)}
          detail="Todas las presentaciones"
        />

        <Kpi
          title="Último lote"
          value={lastBatch?.code ?? "Sin lotes"}
          detail={
            lastBatch
              ? formatDate(lastBatch.productionDate)
              : "Aún no se ha elaborado"
          }
        />
      </section>
      <section className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
        Trazabilidad y caducidad
      </p>

      <h2 className="mt-2 text-2xl font-bold text-on-surface">
        Configuración del producto
      </h2>
    </div>

    <Link
      href={`/liquors/products/${product.slug}/edit`}
      className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2 text-center text-sm font-bold text-on-surface-variant transition duration-150 ease-out hover:text-on-surface hover:scale-[1.04] active:scale-[0.97]"
    >
      Editar configuración
    </Link>
  </div>

  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <ConfigurationValue
      title="Vida útil"
      value={
        product.defaultShelfLifeDays !== null
          ? `${formatNumber(product.defaultShelfLifeDays, 0)} días`
          : "Sin definir"
      }
      detail="Aplicada a nuevas producciones"
    />

    <ConfigurationValue
      title="Alerta amarilla"
      value={`${formatNumber(product.yellowAlertDays, 0)} días`}
      detail="Próxima a caducar"
    />

    <ConfigurationValue
      title="Alerta roja"
      value={`${formatNumber(product.redAlertDays, 0)} días`}
      detail="Atención prioritaria"
    />

    <ConfigurationValue
      title="Fecha en etiqueta"
      value={product.showExpirationOnLabel ? "Sí" : "No"}
      detail="Mostrar fecha de caducidad"
    />

    <ConfigurationValue
      title="Código QR"
      value={product.requiresQr ? "Obligatorio" : "Opcional"}
      detail="Identidad digital por botella"
    />

    <ConfigurationValue
      title="Número de serie"
      value={product.requiresSerialNumber ? "Obligatorio" : "Opcional"}
      detail="Identidad individual"
    />
  </div>

  {product.defaultShelfLifeDays !== null &&
    product.yellowAlertDays > product.defaultShelfLifeDays && (
      <div className="mt-5 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">
        La alerta amarilla no puede ser mayor que la vida útil.
      </div>
    )}

  {product.redAlertDays > product.yellowAlertDays && (
    <div className="mt-5 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">
      La alerta roja no puede ser mayor que la alerta amarilla.
    </div>
  )}
</section>

      <section className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
              Receta vigente
            </p>

            <h2 className="mt-2 text-2xl font-bold text-on-surface">
              {activeRecipe
                ? `${activeRecipe.name} · Versión ${activeRecipe.version}`
                : "Sin receta registrada"}
            </h2>
          </div>

          {activeRecipe && (
            <div className="flex flex-wrap gap-2">
              {activeRecipe.targetLiters !== null && (
                <Badge>
                  Base: {formatNumber(activeRecipe.targetLiters)} L
                </Badge>
              )}

              {activeRecipe.targetAlcohol !== null && (
                <Badge>
                  Objetivo: {formatNumber(activeRecipe.targetAlcohol)}% alcohol
                </Badge>
              )}
            </div>
          )}
        </div>

        {activeRecipe ? (
          <>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {activeRecipe.ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-background/50 p-4"
                >
                  <div>
                    <p className="font-semibold text-on-surface">
                      {ingredient.name}
                    </p>

                    {ingredient.notes && (
                      <p className="mt-1 text-xs text-outline">
                        {ingredient.notes}
                      </p>
                    )}
                  </div>

                  <p className="shrink-0 font-bold text-primary">
                    {formatNumber(ingredient.quantity)} {ingredient.unit}
                  </p>
                </div>
              ))}
            </div>

            {activeRecipe.instructions && (
              <div className="mt-6 rounded-2xl bg-background/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-outline">
                  Procedimiento general
                </p>

                <p className="mt-3 whitespace-pre-line leading-7 text-on-surface-variant">
                  {activeRecipe.instructions}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-outline-variant p-8 text-center">
            <p className="text-lg font-bold text-on-surface">
              Este producto todavía no tiene receta oficial
            </p>

            <p className="mt-2 text-on-surface-variant">
              Cuando registremos la receta base, MAESTRO podrá calcular cualquier
              volumen automáticamente.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div>
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
            Historial
          </p>

          <h2 className="mt-2 text-2xl font-bold text-on-surface">
            Lotes de {product.name}
          </h2>
        </div>

        {product.batches.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-outline-variant p-8 text-center">
            <p className="text-lg font-bold text-on-surface">
              Aún no existen lotes de {product.name}
            </p>

            <p className="mt-2 text-on-surface-variant">
              El primer lote aparecerá aquí con su receta, elaboración,
              resultados y embotellado.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {product.batches.map((batch) => {
              const bottles = batch.bottlings.reduce(
                (sum, bottling) => sum + bottling.producedBottles,
                0
              );

              return (
                <Link
                  key={batch.id}
                  href={`/liquors/batches/${batch.id}`}
                  className="block rounded-2xl border border-outline-variant bg-surface-dim/40 p-5 transition hover:border-primary/25 hover:bg-background"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xl font-bold text-on-surface">
                        {batch.code}
                      </p>

                      <p className="mt-1 text-sm text-on-surface-variant">
                        {formatDate(batch.productionDate)} · Receta versión{" "}
                        {batch.recipe.version}
                      </p>
                    </div>
                    

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <BatchValue
                        title="Planeado"
                        value={`${formatNumber(batch.plannedLiters)} L`}
                      />

                      <BatchValue
                        title="Obtenido"
                        value={
                          batch.actualLiters !== null
                            ? `${formatNumber(batch.actualLiters)} L`
                            : "Pendiente"
                        }
                      />

                      <BatchValue
                        title="Botellas"
                        value={formatNumber(bottles, 0)}
                      />

                      <BatchValue
                        title="Estado"
                        value={formatStatus(batch.status)}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function Kpi({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-2 text-2xl font-black text-on-surface">{value}</p>
      <p className="mt-2 text-xs text-outline">{detail}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5 text-sm font-semibold text-on-surface-variant">
      {children}
    </span>
  );
}
function ConfigurationValue({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-background/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-outline">
        {title}
      </p>

      <p className="mt-2 text-xl font-black text-on-surface">{value}</p>

      <p className="mt-2 text-xs text-outline">{detail}</p>
    </div>
  );
}
function BatchValue({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-outline">
        {title}
      </p>

      <p className="mt-1 font-bold text-on-surface">{value}</p>
    </div>
  );
}

function formatNumber(
  value: number | string | null | undefined,
  maximumFractionDigits = 2
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(number);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City",
  }).format(date);
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}