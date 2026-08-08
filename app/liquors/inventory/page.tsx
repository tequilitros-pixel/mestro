import Link from "next/link";
import type { ComponentType } from "react";
import { LiquorBottleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBottleOrigin } from "@/lib/liquors/bottleOrigin";
import {
  type IconProps,
  PackageIcon,
  BottleIcon,
  ClockIcon,
  CheckIcon,
  AlertIcon,
  TrashIcon,
  HomeIcon,
  CalendarIcon,
} from "@/components/ui/icons";
import PageTabs from "@/components/ui/PageTabs";

type InventoryGroup = {
  key: string;
  productId: string;
  productName: string;
  /** null cuando el grupo es de granel: no hay producto de catálogo. */
  productSlug: string | null;
  productIcon: string;
  sourceLabel: string;
  bottleSizeMl: number;

  total: number;
  available: number;
  reserved: number;
  sold: number;
  loss: number;
  removed: number;

  healthy: number;
  yellowAlert: number;
  redAlert: number;
  expired: number;
  withoutExpiration: number;
};

export default async function LiquorInventoryPage() {
  const bottlings = await prisma.liquorBottling.findMany({
    where: {
      status: {
        not: "CANCELADO",
      },
    },
    select: {
      id: true,
      bottleSizeMl: true,
      batch: {
        select: {
          code: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              active: true,
            },
          },
        },
      },

      // El tequila blanco se embotella desde el granel del proceso, sin
      // lote ni producto de catálogo: su origen es la materia prima.
      rawMaterial: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      bottles: {
  select: {
    status: true,
    expirationDate: true,
    yellowAlertDays: true,
    redAlertDays: true,
  },
},
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const inventoryGroups = buildInventoryGroups(bottlings);
const totals = inventoryGroups.reduce(
  (accumulator, group) => {
    accumulator.total += group.total;
    accumulator.available += group.available;
    accumulator.reserved += group.reserved;
    accumulator.sold += group.sold;
    accumulator.loss += group.loss;
    accumulator.removed += group.removed;

    accumulator.healthy += group.healthy;
    accumulator.yellowAlert += group.yellowAlert;
    accumulator.redAlert += group.redAlert;
    accumulator.expired += group.expired;
    accumulator.withoutExpiration += group.withoutExpiration;

    return accumulator;
  },
  {
    total: 0,
    available: 0,
    reserved: 0,
    sold: 0,
    loss: 0,
    removed: 0,
    healthy: 0,
    yellowAlert: 0,
    redAlert: 0,
    expired: 0,
    withoutExpiration: 0,
  }
);
  const totalAvailableLiters = inventoryGroups.reduce(
    (total, group) =>
      total + group.available * (group.bottleSizeMl / 1000),
    0
  );

  return (
    <section className="mx-auto max-w-7xl">
      <header className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-sm font-black uppercase tracking-[0.35em] text-on-surface-variant">
                Elaboración de licores
              </p>

              <h1 className="mt-3 flex items-center gap-3 text-4xl font-black text-on-surface sm:text-5xl">
                <PackageIcon className="h-9 w-9 text-on-surface-variant" />
                Inventario
              </h1>

              <p className="mt-4 max-w-2xl text-on-surface-variant">
                Consulta las existencias de producto terminado por licor,
                presentación y estado de cada botella.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant bg-surface-container-high px-6 py-5">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                Volumen disponible
              </p>

              <p className="mt-2 text-4xl font-black text-on-surface">
                {formatNumber(totalAvailableLiters, 3)} L
              </p>

              <p className="mt-2 text-sm text-on-surface-variant">
                Producto listo para utilizar
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-6">
        <PageTabs
          tabs={[
            {
              key: "resumen",
              label: "Resumen",
              icon: <HomeIcon className="h-4 w-4" />,
              content: (
                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <InventoryKpi
                    icon={PackageIcon}
                    title="Total"
                    value={totals.total}
                    detail="Botellas registradas"
                  />

                  <InventoryKpi
                    icon={BottleIcon}
                    title="Disponibles"
                    value={totals.available}
                    detail="Existencia actual"
                  />

                  <InventoryKpi
                    icon={ClockIcon}
                    title="Reservadas"
                    value={totals.reserved}
                    detail="Apartadas"
                  />

                  <InventoryKpi
                    icon={CheckIcon}
                    title="Vendidas"
                    value={totals.sold}
                    detail="Salidas registradas"
                  />

                  <InventoryKpi
                    icon={AlertIcon}
                    title="Merma"
                    value={totals.loss}
                    detail="Producto perdido"
                  />

                  <InventoryKpi
                    icon={TrashIcon}
                    title="Retiradas"
                    value={totals.removed}
                    detail="Fuera de circulación"
                  />
                </section>
              ),
            },
            {
              key: "existencias",
              label: "Existencias",
              icon: <BottleIcon className="h-4 w-4" />,
              content: (
                <section>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-black uppercase tracking-[0.3em] text-on-surface-variant">
                        Producto terminado
                      </p>

                      <h2 className="mt-2 text-3xl font-black text-on-surface">
                        Existencias por presentación
                      </h2>
                    </div>

                    <p className="text-sm text-outline">
                      {inventoryGroups.length} grupos de inventario
                    </p>
                  </div>

                  {inventoryGroups.length === 0 ? (
                    <EmptyInventory />
                  ) : (
                    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {inventoryGroups.map((group) => (
                        <InventoryCard key={group.key} group={group} />
                      ))}
                    </div>
                  )}
                </section>
              ),
            },
            {
              key: "caducidades",
              label: "Caducidades",
              icon: <CalendarIcon className="h-4 w-4" />,
              content: (
                <section className="rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
                  <div>
                    <p className="font-mono text-sm font-black uppercase tracking-[0.3em] text-on-surface-variant">
                      Control de caducidades
                    </p>

                    <h2 className="mt-2 text-3xl font-black text-on-surface">
                      Estado del inventario actual
                    </h2>

                    <p className="mt-2 text-sm text-on-surface-variant">
                      Análisis de botellas disponibles y reservadas según su fecha de
                      caducidad.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <ExpirationKpi
                      title="Vigentes"
                      value={totals.healthy}
                      detail="Sin riesgo próximo"
                      tone="green"
                    />

                    <ExpirationKpi
                      title="Alerta amarilla"
                      value={totals.yellowAlert}
                      detail="Próximas a caducar"
                      tone="yellow"
                    />

                    <ExpirationKpi
                      title="Alerta roja"
                      value={totals.redAlert}
                      detail="Salida prioritaria"
                      tone="orange"
                    />

                    <ExpirationKpi
                      title="Caducadas"
                      value={totals.expired}
                      detail="Requieren atención"
                      tone="red"
                    />

                    <ExpirationKpi
                      title="Sin caducidad"
                      value={totals.withoutExpiration}
                      detail="Falta información"
                      tone="slate"
                    />
                  </div>
                </section>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function InventoryCard({ group }: { group: InventoryGroup }) {
  const availableLiters =
    group.available * (group.bottleSizeMl / 1000);

  const unavailable =
    group.reserved +
    group.sold +
    group.loss +
    group.removed;

  const availabilityPercentage =
    group.total > 0
      ? Math.round((group.available / group.total) * 100)
      : 0;

  return (
    <article className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container transition hover:border-primary/25">
      <div className="border-b border-outline-variant bg-background/30 p-6">
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high text-3xl">
              {group.productIcon}
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-2xl font-black text-on-surface">
                {group.productName}
              </h3>

              <p className="mt-1 text-lg font-bold text-primary">
                {formatBottleSize(group.bottleSizeMl)}
              </p>
            </div>
          </div>

          <div className="rounded-full border border-tertiary-fixed-dim/25 bg-tertiary-fixed-dim/10 px-3 py-1 text-xs font-black text-tertiary-fixed-dim">
            {availabilityPercentage}%
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <InventoryValue
            label="Disponibles"
            value={formatNumber(group.available, 0)}
            detail={`${formatNumber(availableLiters, 3)} L`}
          />

          <InventoryValue
            label="Total"
            value={formatNumber(group.total, 0)}
            detail={`${formatNumber(unavailable, 0)} no disponibles`}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <span className="text-outline">Existencia disponible</span>
            <span className="text-on-surface-variant">
              {group.available} de {group.total}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${availabilityPercentage}%`,
              }}
            />
          </div>
        </div>
<div className="mt-6 rounded-2xl border border-outline-variant bg-surface-dim/40 p-4">
  <div className="flex items-center justify-between gap-3">
    <p className="text-xs font-black uppercase tracking-wider text-outline">
      Caducidad del inventario
    </p>

    {group.expired > 0 ? (
      <span className="rounded-full border border-error/25 bg-error/10 px-3 py-1 text-xs font-black text-error">
        Atención
      </span>
    ) : group.redAlert > 0 ? (
      <span className="rounded-full border border-error/25 bg-error/10 px-3 py-1 text-xs font-black text-error">
        Prioridad
      </span>
    ) : group.yellowAlert > 0 ? (
      <span className="rounded-full border border-secondary/25 bg-secondary/10 px-3 py-1 text-xs font-black text-secondary">
        Preventivo
      </span>
    ) : (
      <span className="rounded-full border border-tertiary-fixed-dim/25 bg-tertiary-fixed-dim/10 px-3 py-1 text-xs font-black text-tertiary-fixed-dim">
        Saludable
      </span>
    )}
  </div>

  <div className="mt-4 grid grid-cols-2 gap-3">
    <ExpirationValue
      label="Vigentes"
      value={group.healthy}
      dotClass="bg-tertiary-fixed-dim"
    />

    <ExpirationValue
      label="Amarilla"
      value={group.yellowAlert}
      dotClass="bg-secondary"
    />

    <ExpirationValue
      label="Roja"
      value={group.redAlert}
      dotClass="bg-error"
    />

    <ExpirationValue
      label="Caducadas"
      value={group.expired}
      dotClass="bg-error"
    />
  </div>

  {group.withoutExpiration > 0 && (
    <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-outline">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-outline-variant" />
      {group.withoutExpiration} botellas no tienen fecha de
      caducidad registrada.
    </p>
  )}
</div>
        <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-outline-variant pt-5">
          <StatusValue
            label="Reservadas"
            value={group.reserved}
          />

          <StatusValue
            label="Vendidas"
            value={group.sold}
          />

          <StatusValue
            label="Merma"
            value={group.loss}
          />

          <StatusValue
            label="Retiradas"
            value={group.removed}
          />
        </div>

        {/* El detalle por producto se navega por slug; el granel no
            tiene producto de catálogo al que dirigir. */}
        {group.productSlug ? (
          <Link
            href={`/liquors/inventory/${group.productSlug}?size=${group.bottleSizeMl}`}
            className="mt-6 block w-full rounded-2xl bg-primary px-5 py-4 text-center font-black text-on-surface transition hover:opacity-90"
          >
            Ver botellas →
          </Link>
        ) : (
          <p className="mt-6 w-full rounded-2xl border border-outline-variant bg-surface-dim/40 px-5 py-4 text-center text-sm font-black text-outline">
            {group.sourceLabel}
          </p>
        )}
      </div>
    </article>
  );
}

function InventoryKpi({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high/70">
        <Icon className="h-5 w-5 text-on-surface-variant" />
      </div>

      <p className="mt-4 text-sm font-bold text-on-surface-variant">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black text-on-surface">
        {formatNumber(value, 0)}
      </p>

      <p className="mt-2 text-xs text-outline">{detail}</p>
    </div>
  );
}

function InventoryValue({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-outline">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-on-surface">
        {value}
      </p>

      <p className="mt-1 text-xs text-outline">{detail}</p>
    </div>
  );
}

function StatusValue({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-outline">{label}</span>

      <span className="font-black text-on-surface">
        {formatNumber(value, 0)}
      </span>
    </div>
  );
}
function ExpirationKpi({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  tone: "green" | "yellow" | "orange" | "red" | "slate";
}) {
  const toneClasses = {
    green: "border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim",
    yellow:
      "border-secondary/20 bg-secondary/10 text-secondary",
    orange:
      "border-error/20 bg-error/10 text-error",
    red: "border-error/20 bg-error/10 text-error",
    slate: "border-outline-variant bg-surface-dim/40 text-on-surface-variant",
  };

  const dotClasses = {
    green: "bg-tertiary-fixed-dim",
    yellow: "bg-secondary",
    orange: "bg-error",
    red: "bg-error",
    slate: "bg-on-surface-variant",
  };

  return (
    <div
      className={`rounded-2xl border p-5 ${toneClasses[tone]}`}
    >
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClasses[tone]}`} />

      <p className="mt-4 text-sm font-bold opacity-80">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black text-on-surface">
        {formatNumber(value, 0)}
      </p>

      <p className="mt-2 text-xs opacity-60">{detail}</p>
    </div>
  );
}

function ExpirationValue({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-outline">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
        {label}
      </p>

      <p className="mt-1 text-xl font-black text-on-surface">
        {formatNumber(value, 0)}
      </p>
    </div>
  );
}
function EmptyInventory() {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-8 text-center sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high">
        <PackageIcon className="h-7 w-7 text-on-surface-variant" />
      </div>

      <h3 className="mt-5 text-2xl font-black text-on-surface">
        Todavía no hay botellas en inventario
      </h3>

      <p className="mx-auto mt-3 max-w-xl text-on-surface-variant">
        Las botellas aparecerán aquí automáticamente cuando termines un
        embotellado.
      </p>

      <Link
        href="/liquors/batches"
        className="mt-6 inline-flex rounded-2xl bg-primary px-6 py-4 font-black text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
      >
        Ver lotes de producción
      </Link>
    </div>
  );
}

function buildInventoryGroups(
  bottlings: Array<{
    bottleSizeMl: number;
    batch: {
      code: string;
      product: {
        id: string;
        name: string;
        slug: string;
        icon: string | null;
        active: boolean;
      };
    } | null;
    rawMaterial: {
      id: string;
      code: string;
      name: string;
    } | null;
   bottles: Array<{
  status: LiquorBottleStatus;
  expirationDate: Date | null;
  yellowAlertDays: number | null;
  redAlertDays: number | null;
}>;
  }>
) {
  const groups = new Map<string, InventoryGroup>();

  for (const bottling of bottlings) {
    const origin = resolveBottleOrigin(bottling);
    const product = bottling.batch?.product ?? null;

    /*
     * Los embotellados de granel (tequila blanco del proceso) no tienen
     * lote ni producto de catálogo, así que el grupo se identifica con
     * la materia prima de la que salieron.
     */
    const identityId =
      product?.id ?? bottling.rawMaterial?.id ?? origin.sourceCode;

    const key = `${identityId}-${bottling.bottleSizeMl}`;

    const current =
      groups.get(key) ??
      {
        key,
        productId: identityId,
        productName: origin.productName,
        productSlug: product?.slug ?? null,
        productIcon: origin.productIcon ?? "🍾",
        sourceLabel: origin.sourceLabel,
        bottleSizeMl: bottling.bottleSizeMl,
        total: 0,
        available: 0,
        reserved: 0,
        sold: 0,
        loss: 0,
        removed: 0,

        healthy: 0,
yellowAlert: 0,
redAlert: 0,
expired: 0,
withoutExpiration: 0,
      };

    for (const bottle of bottling.bottles) {
      current.total += 1;

      switch (bottle.status) {
        case LiquorBottleStatus.DISPONIBLE:
          current.available += 1;
          break;

        case LiquorBottleStatus.RESERVADA:
          current.reserved += 1;
          break;

        case LiquorBottleStatus.VENDIDA:
          current.sold += 1;
          break;

        case LiquorBottleStatus.MERMA:
          current.loss += 1;
          break;

        case LiquorBottleStatus.RETIRADA:
          current.removed += 1;
          break;
      }

      /*
       * El control de caducidad solo aplica a botellas que siguen
       * en inventario (disponibles o reservadas). Antes este cálculo
       * vivía después de un `break` dentro del case DISPONIBLE, así
       * que nunca se ejecutaba para ninguna botella.
       */
      const isCurrentInventory =
        bottle.status === LiquorBottleStatus.DISPONIBLE ||
        bottle.status === LiquorBottleStatus.RESERVADA;

      if (!isCurrentInventory) {
        continue;
      }

      const expirationStatus = getExpirationStatus({
        expirationDate: bottle.expirationDate,
        yellowAlertDays: bottle.yellowAlertDays,
        redAlertDays: bottle.redAlertDays,
      });

      switch (expirationStatus) {
        case "HEALTHY":
          current.healthy += 1;
          break;

        case "YELLOW":
          current.yellowAlert += 1;
          break;

        case "RED":
          current.redAlert += 1;
          break;

        case "EXPIRED":
          current.expired += 1;
          break;

        case "WITHOUT_EXPIRATION":
          current.withoutExpiration += 1;
          break;
      }
    }

    groups.set(key, current);
  }

  return Array.from(groups.values()).sort((first, second) => {
    const productComparison = first.productName.localeCompare(
      second.productName,
      "es"
    );

    if (productComparison !== 0) {
      return productComparison;
    }

    return first.bottleSizeMl - second.bottleSizeMl;
  });
}
type ExpirationStatus =
  | "HEALTHY"
  | "YELLOW"
  | "RED"
  | "EXPIRED"
  | "WITHOUT_EXPIRATION";

function getExpirationStatus({
  expirationDate,
  yellowAlertDays,
  redAlertDays,
}: {
  expirationDate: Date | null;
yellowAlertDays: number | null;
redAlertDays: number | null;
}): ExpirationStatus {
  if (!expirationDate) {
    return "WITHOUT_EXPIRATION";
  }
const safeYellowAlertDays =
  yellowAlertDays !== null && yellowAlertDays > 0
    ? yellowAlertDays
    : 30;

const safeRedAlertDays =
  redAlertDays !== null && redAlertDays > 0
    ? redAlertDays
    : 7;
  const today = startOfDay(new Date());
  const expiration = startOfDay(expirationDate);

  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  const daysRemaining = Math.ceil(
    (expiration.getTime() - today.getTime()) /
      millisecondsPerDay
  );

  if (daysRemaining < 0) {
    return "EXPIRED";
  }

  if (daysRemaining <= safeRedAlertDays) {
  return "RED";
}

if (daysRemaining <= safeYellowAlertDays) {
  return "YELLOW";
}

  return "HEALTHY";
}

function startOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
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