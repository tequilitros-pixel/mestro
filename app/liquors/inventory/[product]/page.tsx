import Link from "next/link";
import { LiquorBottleStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    product: string;
  }>;
  searchParams: Promise<{
    size?: string;
    status?: string;
  }>;
};

export default async function LiquorProductInventoryPage({
  params,
  searchParams,
}: PageProps) {
  const { product: productSlug } = await params;
  const query = await searchParams;

  const bottleSizeMl = parseBottleSize(query.size);
  const selectedStatus = parseBottleStatus(query.status);

  const product = await prisma.liquorProduct.findUnique({
    where: {
      slug: productSlug,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      description: true,
      defaultAlcohol: true,
      active: true,
    },
  });

  if (!product) {
    notFound();
  }

  const bottles = await prisma.liquorBottle.findMany({
    where: {
      bottling: {
        batch: {
          productId: product.id,
        },
        ...(bottleSizeMl
          ? {
              bottleSizeMl,
            }
          : {}),
      },
      ...(selectedStatus
        ? {
            status: selectedStatus,
          }
        : {}),
    },
    select: {
      id: true,
      code: true,
      serialNumber: true,
      qrToken: true,
      status: true,
      bottledAt: true,
      expirationDate: true,
      currentLocation: true,
      createdAt: true,
      bottling: {
        select: {
          bottleSizeMl: true,
          code: true,
          batch: {
            select: {
              id: true,
              code: true,
              finalAlcohol: true,
              productionDate: true,
              expirationDate: true,
              recipe: {
                select: {
                  id: true,
                  name: true,
                  version: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      {
        bottling: {
          batch: {
            productionDate: "desc",
          },
        },
      },
      {
        serialNumber: "asc",
      },
    ],
  });

  const allProductBottles = await prisma.liquorBottle.findMany({
    where: {
      bottling: {
        batch: {
          productId: product.id,
        },
        ...(bottleSizeMl
          ? {
              bottleSizeMl,
            }
          : {}),
      },
    },
    select: {
      status: true,
    },
  });

  const totals = countBottleStatuses(allProductBottles);

  const availableLiters =
    bottles
      .filter(
        (bottle) =>
          bottle.status === LiquorBottleStatus.DISPONIBLE
      )
      .reduce(
        (total, bottle) =>
          total + bottle.bottling.bottleSizeMl / 1000,
        0
      );

  const presentation =
    bottleSizeMl !== null
      ? formatBottleSize(bottleSizeMl)
      : "Todas las presentaciones";

  return (
    <section className="mx-auto max-w-7xl">
      <div className="mb-6">
        <Link
          href="/liquors/inventory"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"
        >
          ← Volver al inventario
        </Link>
      </div>

      <header className="overflow-hidden rounded-3xl border border-purple-500/20 bg-slate-900">
        <div className="bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-slate-900 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/10 text-4xl">
                {product.icon ?? "🍾"}
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">
                  Inventario de botellas
                </p>

                <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">
                  {product.name}
                </h1>

                <p className="mt-3 text-lg font-bold text-purple-200">
                  {presentation}
                </p>

                {product.description ? (
                  <p className="mt-3 max-w-2xl text-slate-400">
                    {product.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <HeaderValue
                label="Botellas mostradas"
                value={formatNumber(bottles.length, 0)}
              />

              <HeaderValue
                label="Litros disponibles"
                value={`${formatNumber(availableLiters, 3)} L`}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatusKpi
          label="Total"
          value={totals.total}
          icon="📦"
          active={!selectedStatus}
          href={buildFilterUrl(product.slug, bottleSizeMl, null)}
        />

        <StatusKpi
          label="Disponibles"
          value={totals.available}
          icon="🍾"
          active={
            selectedStatus === LiquorBottleStatus.DISPONIBLE
          }
          href={buildFilterUrl(
            product.slug,
            bottleSizeMl,
            LiquorBottleStatus.DISPONIBLE
          )}
        />

        <StatusKpi
          label="Reservadas"
          value={totals.reserved}
          icon="🟡"
          active={
            selectedStatus === LiquorBottleStatus.RESERVADA
          }
          href={buildFilterUrl(
            product.slug,
            bottleSizeMl,
            LiquorBottleStatus.RESERVADA
          )}
        />

        <StatusKpi
          label="Vendidas"
          value={totals.sold}
          icon="✅"
          active={selectedStatus === LiquorBottleStatus.VENDIDA}
          href={buildFilterUrl(
            product.slug,
            bottleSizeMl,
            LiquorBottleStatus.VENDIDA
          )}
        />

        <StatusKpi
          label="Fuera de inventario"
          value={totals.loss + totals.removed}
          icon="⚠️"
          active={
            selectedStatus === LiquorBottleStatus.MERMA ||
            selectedStatus === LiquorBottleStatus.RETIRADA
          }
          href={buildFilterUrl(
            product.slug,
            bottleSizeMl,
            LiquorBottleStatus.MERMA
          )}
        />
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-400">
              Botellas individuales
            </p>

            <h2 className="mt-2 text-3xl font-black text-white">
              {selectedStatus
                ? getStatusLabel(selectedStatus)
                : "Todas las botellas"}
            </h2>
          </div>

          <p className="text-sm text-slate-500">
            {formatNumber(bottles.length, 0)} resultados
          </p>
        </div>

        {bottles.length === 0 ? (
          <EmptyBottleList />
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {bottles.map((bottle) => (
              <BottleCard key={bottle.id} bottle={bottle} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function BottleCard({
  bottle,
}: {
  bottle: {
    id: string;
    code: string;
    serialNumber: number;
    qrToken: string;
    status: LiquorBottleStatus;
    bottledAt: DateTimeValue;
    expirationDate: DateTimeValue;
    currentLocation: string | null;
    createdAt: Date;
    bottling: {
      bottleSizeMl: number;
      code: string;
      batch: {
        id: string;
        code: string;
        finalAlcohol: number | null;
        productionDate: Date;
        expirationDate: Date | null;
        recipe: {
          id: string;
          name: string;
          version: number;
        };
      };
    };
  };
}) {
  const statusStyle = getStatusStyle(bottle.status);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 transition hover:-translate-y-1 hover:border-purple-500/40">
      <div className="border-b border-slate-800 bg-slate-950/30 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
              Botella
            </p>

            <h3 className="mt-2 break-all text-xl font-black text-white">
              {bottle.code}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Serie #{formatSerialNumber(bottle.serialNumber)}
            </p>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyle}`}
          >
            {getStatusLabel(bottle.status)}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-4">
          <BottleValue
            label="Presentación"
            value={formatBottleSize(
              bottle.bottling.bottleSizeMl
            )}
          />

          <BottleValue
            label="Alcohol"
            value={
              bottle.bottling.batch.finalAlcohol !== null
                ? `${formatNumber(
                    bottle.bottling.batch.finalAlcohol,
                    2
                  )}%`
                : "—"
            }
          />

          <BottleValue
            label="Lote"
            value={bottle.bottling.batch.code}
          />

          <BottleValue
            label="Receta"
            value={`${bottle.bottling.batch.recipe.name} V${bottle.bottling.batch.recipe.version}`}
          />
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-800 pt-5">
          <BottleDetail
            label="Embotellada"
            value={formatDate(
              bottle.bottledAt ?? bottle.createdAt
            )}
          />

          <BottleDetail
            label="Caducidad"
            value={formatDate(
              bottle.expirationDate ??
                bottle.bottling.batch.expirationDate
            )}
          />

          <BottleDetail
            label="Ubicación"
            value={
              bottle.currentLocation ?? "Almacén principal"
            }
          />
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href={`/liquors/bottles/${bottle.id}`}
            className="flex-1 rounded-2xl bg-purple-600 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-purple-500"
          >
            Ver detalle
          </Link>

          <Link
            href={`/liquors/bottles/${bottle.id}/qr`}
            aria-label={`Ver QR de ${bottle.code}`}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl transition hover:border-purple-500 hover:bg-slate-700"
          >
            ▦
          </Link>
        </div>
      </div>
    </article>
  );
}

function HeaderValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-purple-400/20 bg-purple-500/10 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-purple-200/60">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  );
}

function StatusKpi({
  label,
  value,
  icon,
  active,
  href,
}: {
  label: string;
  value: number;
  icon: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-5 transition ${
        active
          ? "border-purple-500 bg-purple-500/15"
          : "border-slate-800 bg-slate-900 hover:border-purple-500/40"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/80 text-xl">
          {icon}
        </div>

        {active ? (
          <span className="rounded-full bg-purple-500 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
            Activo
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-sm font-bold text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {formatNumber(value, 0)}
      </p>
    </Link>
  );
}

function BottleValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words font-black text-white">
        {value}
      </p>
    </div>
  );
}

function BottleDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500">{label}</span>

      <span className="text-right text-sm font-bold text-slate-200">
        {value}
      </span>
    </div>
  );
}

function EmptyBottleList() {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
        🍾
      </div>

      <h3 className="mt-5 text-2xl font-black text-white">
        No hay botellas con este filtro
      </h3>

      <p className="mx-auto mt-3 max-w-xl text-slate-400">
        Cambia el estado seleccionado o vuelve al inventario
        general.
      </p>
    </div>
  );
}

function countBottleStatuses(
  bottles: Array<{
    status: LiquorBottleStatus;
  }>
) {
  const totals = {
    total: bottles.length,
    available: 0,
    reserved: 0,
    sold: 0,
    loss: 0,
    removed: 0,
  };

  for (const bottle of bottles) {
    switch (bottle.status) {
      case LiquorBottleStatus.DISPONIBLE:
        totals.available += 1;
        break;

      case LiquorBottleStatus.RESERVADA:
        totals.reserved += 1;
        break;

      case LiquorBottleStatus.VENDIDA:
        totals.sold += 1;
        break;

      case LiquorBottleStatus.MERMA:
        totals.loss += 1;
        break;

      case LiquorBottleStatus.RETIRADA:
        totals.removed += 1;
        break;
    }
  }

  return totals;
}

function parseBottleSize(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function parseBottleStatus(
  value: string | undefined
): LiquorBottleStatus | null {
  if (!value) {
    return null;
  }

  const statuses = Object.values(LiquorBottleStatus);

  return statuses.includes(value as LiquorBottleStatus)
    ? (value as LiquorBottleStatus)
    : null;
}

function buildFilterUrl(
  productSlug: string,
  bottleSizeMl: number | null,
  status: LiquorBottleStatus | null
) {
  const parameters = new URLSearchParams();

  if (bottleSizeMl !== null) {
    parameters.set("size", bottleSizeMl.toString());
  }

  if (status !== null) {
    parameters.set("status", status);
  }

  const query = parameters.toString();

  return `/liquors/inventory/${productSlug}${
    query ? `?${query}` : ""
  }`;
}

function getStatusLabel(status: LiquorBottleStatus) {
  switch (status) {
    case LiquorBottleStatus.DISPONIBLE:
      return "Disponible";

    case LiquorBottleStatus.RESERVADA:
      return "Reservada";

    case LiquorBottleStatus.VENDIDA:
      return "Vendida";

    case LiquorBottleStatus.MERMA:
      return "Merma";

    case LiquorBottleStatus.RETIRADA:
      return "Retirada";

    default:
      return status;
  }
}

function getStatusStyle(status: LiquorBottleStatus) {
  switch (status) {
    case LiquorBottleStatus.DISPONIBLE:
      return "border-green-500/30 bg-green-500/10 text-green-300";

    case LiquorBottleStatus.RESERVADA:
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";

    case LiquorBottleStatus.VENDIDA:
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    case LiquorBottleStatus.MERMA:
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";

    case LiquorBottleStatus.RETIRADA:
      return "border-red-500/30 bg-red-500/10 text-red-300";

    default:
      return "border-slate-600 bg-slate-800 text-slate-300";
  }
}

function formatSerialNumber(serialNumber: number) {
  return serialNumber.toString().padStart(6, "0");
}

function formatBottleSize(sizeMl: number) {
  if (sizeMl >= 1000) {
    const liters = sizeMl / 1000;

    return `${formatNumber(liters, 2)} ${
      liters === 1 ? "litro" : "litros"
    }`;
  }

  return `${formatNumber(sizeMl, 0)} ml`;
}

type DateTimeValue = Date | null;

function formatDate(value: DateTimeValue) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}