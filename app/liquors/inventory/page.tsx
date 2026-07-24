import Link from "next/link";
import { LiquorBottleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type InventoryGroup = {
  key: string;
  productId: string;
  productName: string;
  productSlug: string;
  productIcon: string;
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
      <header className="overflow-hidden rounded-3xl border border-purple-500/20 bg-slate-900">
        <div className="bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-slate-900 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-purple-300">
                Elaboración de licores
              </p>

              <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">
                📦 Inventario
              </h1>

              <p className="mt-4 max-w-2xl text-slate-300">
                Consulta las existencias de producto terminado por licor,
                presentación y estado de cada botella.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300/70">
                Volumen disponible
              </p>

              <p className="mt-2 text-4xl font-black text-white">
                {formatNumber(totalAvailableLiters, 3)} L
              </p>

              <p className="mt-2 text-sm text-purple-100/60">
                Producto listo para utilizar
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <InventoryKpi
          icon="📦"
          title="Total"
          value={totals.total}
          detail="Botellas registradas"
        />

        <InventoryKpi
          icon="🍾"
          title="Disponibles"
          value={totals.available}
          detail="Existencia actual"
        />

        <InventoryKpi
          icon="🟡"
          title="Reservadas"
          value={totals.reserved}
          detail="Apartadas"
        />

        <InventoryKpi
          icon="✅"
          title="Vendidas"
          value={totals.sold}
          detail="Salidas registradas"
        />

        <InventoryKpi
          icon="⚠️"
          title="Merma"
          value={totals.loss}
          detail="Producto perdido"
        />

        <InventoryKpi
          icon="⛔"
          title="Retiradas"
          value={totals.removed}
          detail="Fuera de circulación"
        />
      </section>
<section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
  <div>
    <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-400">
      Control de caducidades
    </p>

    <h2 className="mt-2 text-3xl font-black text-white">
      Estado del inventario actual
    </h2>

    <p className="mt-2 text-sm text-slate-400">
      Análisis de botellas disponibles y reservadas según su fecha de
      caducidad.
    </p>
  </div>

  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <ExpirationKpi
      icon="🟢"
      title="Vigentes"
      value={totals.healthy}
      detail="Sin riesgo próximo"
      tone="green"
    />

    <ExpirationKpi
      icon="🟡"
      title="Alerta amarilla"
      value={totals.yellowAlert}
      detail="Próximas a caducar"
      tone="yellow"
    />

    <ExpirationKpi
      icon="🟠"
      title="Alerta roja"
      value={totals.redAlert}
      detail="Salida prioritaria"
      tone="orange"
    />

    <ExpirationKpi
      icon="🔴"
      title="Caducadas"
      value={totals.expired}
      detail="Requieren atención"
      tone="red"
    />

    <ExpirationKpi
      icon="⚪"
      title="Sin caducidad"
      value={totals.withoutExpiration}
      detail="Falta información"
      tone="slate"
    />
  </div>
</section>
      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-400">
              Producto terminado
            </p>

            <h2 className="mt-2 text-3xl font-black text-white">
              Existencias por presentación
            </h2>
          </div>

          <p className="text-sm text-slate-500">
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
    <article className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 transition hover:border-purple-500/40">
      <div className="border-b border-slate-800 bg-slate-950/30 p-6">
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
              {group.productIcon}
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-2xl font-black text-white">
                {group.productName}
              </h3>

              <p className="mt-1 text-lg font-bold text-purple-300">
                {formatBottleSize(group.bottleSizeMl)}
              </p>
            </div>
          </div>

          <div className="rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
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
            <span className="text-slate-500">Existencia disponible</span>
            <span className="text-slate-300">
              {group.available} de {group.total}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{
                width: `${availabilityPercentage}%`,
              }}
            />
          </div>
        </div>
<div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
  <div className="flex items-center justify-between gap-3">
    <p className="text-xs font-black uppercase tracking-wider text-slate-500">
      Caducidad del inventario
    </p>

    {group.expired > 0 ? (
      <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
        Atención
      </span>
    ) : group.redAlert > 0 ? (
      <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">
        Prioridad
      </span>
    ) : group.yellowAlert > 0 ? (
      <span className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300">
        Preventivo
      </span>
    ) : (
      <span className="rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
        Saludable
      </span>
    )}
  </div>

  <div className="mt-4 grid grid-cols-2 gap-3">
    <ExpirationValue
      label="🟢 Vigentes"
      value={group.healthy}
    />

    <ExpirationValue
      label="🟡 Amarilla"
      value={group.yellowAlert}
    />

    <ExpirationValue
      label="🟠 Roja"
      value={group.redAlert}
    />

    <ExpirationValue
      label="🔴 Caducadas"
      value={group.expired}
    />
  </div>

  {group.withoutExpiration > 0 && (
    <p className="mt-4 text-xs font-semibold text-slate-500">
      ⚪ {group.withoutExpiration} botellas no tienen fecha de
      caducidad registrada.
    </p>
  )}
</div>
        <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-slate-800 pt-5">
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

        <Link
          href={`/liquors/inventory/${group.productSlug}?size=${group.bottleSizeMl}`}
          className="mt-6 block w-full rounded-2xl bg-purple-600 px-5 py-4 text-center font-black text-white transition hover:bg-purple-500"
        >
          Ver botellas →
        </Link>
      </div>
    </article>
  );
}

function InventoryKpi({
  icon,
  title,
  value,
  detail,
}: {
  icon: string;
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/70 text-xl">
        {icon}
      </div>

      <p className="mt-4 text-sm font-bold text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {formatNumber(value, 0)}
      </p>

      <p className="mt-2 text-xs text-slate-500">{detail}</p>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">{detail}</p>
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
      <span className="text-sm text-slate-500">{label}</span>

      <span className="font-black text-slate-200">
        {formatNumber(value, 0)}
      </span>
    </div>
  );
}
function ExpirationKpi({
  icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: string;
  title: string;
  value: number;
  detail: string;
  tone: "green" | "yellow" | "orange" | "red" | "slate";
}) {
  const toneClasses = {
    green: "border-green-500/20 bg-green-500/10 text-green-300",
    yellow:
      "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
    orange:
      "border-orange-500/20 bg-orange-500/10 text-orange-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    slate: "border-slate-700 bg-slate-950/40 text-slate-300",
  };

  return (
    <div
      className={`rounded-2xl border p-5 ${toneClasses[tone]}`}
    >
      <div className="text-2xl">{icon}</div>

      <p className="mt-4 text-sm font-bold opacity-80">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {formatNumber(value, 0)}
      </p>

      <p className="mt-2 text-xs opacity-60">{detail}</p>
    </div>
  );
}

function ExpirationValue({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-black text-white">
        {formatNumber(value, 0)}
      </p>
    </div>
  );
}
function EmptyInventory() {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
        📦
      </div>

      <h3 className="mt-5 text-2xl font-black text-white">
        Todavía no hay botellas en inventario
      </h3>

      <p className="mx-auto mt-3 max-w-xl text-slate-400">
        Las botellas aparecerán aquí automáticamente cuando termines un
        embotellado.
      </p>

      <Link
        href="/liquors/batches"
        className="mt-6 inline-flex rounded-2xl bg-purple-600 px-6 py-4 font-black text-white transition hover:bg-purple-500"
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
      product: {
        id: string;
        name: string;
        slug: string;
        icon: string | null;
        active: boolean;
      };
    };
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
    const product = bottling.batch.product;
    const key = `${product.id}-${bottling.bottleSizeMl}`;

    const current =
      groups.get(key) ??
      {
        key,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productIcon: product.icon ?? "🍾",
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