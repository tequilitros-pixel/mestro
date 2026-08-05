import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export default async function LiquorExpirationPage() {
  const now = new Date();

  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const in60Days = new Date(now);
  in60Days.setDate(in60Days.getDate() + 60);

  const bottles = await prisma.liquorBottle.findMany({
    where: {
      expirationDate: {
        not: null,
      },
      status: {
        in: ["DISPONIBLE", "RESERVADA"],
      },
    },
    orderBy: {
      expirationDate: "asc",
    },
    include: {
      bottling: {
        include: {
          batch: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  const expired = bottles.filter(
    (bottle) =>
      bottle.expirationDate &&
      bottle.expirationDate < now
  );

  const next30Days = bottles.filter(
    (bottle) =>
      bottle.expirationDate &&
      bottle.expirationDate >= now &&
      bottle.expirationDate <= in30Days
  );

  const next60Days = bottles.filter(
    (bottle) =>
      bottle.expirationDate &&
      bottle.expirationDate > in30Days &&
      bottle.expirationDate <= in60Days
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div>
        <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Control de inventario
        </p>

        <h1 className="mt-2 text-3xl font-black text-on-surface">
          Caducidad
        </h1>

        <p className="mt-2 text-on-surface-variant">
          Consulta las botellas vencidas o próximas a vencer.
        </p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Caducadas"
          value={expired.length}
          style="border-error/25 bg-error/10 text-error"
        />

        <SummaryCard
          label="Próximos 30 días"
          value={next30Days.length}
          style="border-error/25 bg-error/10 text-error"
        />

        <SummaryCard
          label="De 31 a 60 días"
          value={next60Days.length}
          style="border-secondary/25 bg-secondary/10 text-secondary"
        />
      </section>

      <ExpirationSection
        title="Botellas caducadas"
        bottles={expired}
        emptyText="No hay botellas caducadas."
      />

      <ExpirationSection
        title="Caducan en los próximos 30 días"
        bottles={next30Days}
        emptyText="No hay botellas próximas a vencer."
      />

      <ExpirationSection
        title="Caducan entre 31 y 60 días"
        bottles={next60Days}
        emptyText="No hay botellas en este periodo."
      />
    </main>
  );
}

function SummaryCard({
  label,
  value,
  style,
}: {
  label: string;
  value: number;
  style: string;
}) {
  return (
    <div className={`rounded-3xl border p-6 ${style}`}>
      <p className="text-sm font-black uppercase tracking-wider">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-on-surface">
        {value}
      </p>

      <p className="mt-1 text-sm">
        {value === 1 ? "botella" : "botellas"}
      </p>
    </div>
  );
}

type BottleWithRelations = Prisma.LiquorBottleGetPayload<{
  include: {
    bottling: {
      include: {
        batch: {
          include: {
            product: true;
          };
        };
      };
    };
  };
}>;

function ExpirationSection({
  title,
  bottles,
  emptyText,
}: {
  title: string;
  bottles: BottleWithRelations[];
  emptyText: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-black text-on-surface">
        {title}
      </h2>

      {bottles.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container/50 p-6 text-outline">
          {emptyText}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container/60">
          <div className="divide-y divide-outline-variant">
            {bottles.map((bottle) => {
              const batch = bottle.bottling.batch;

              return (
                <div
                  key={bottle.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-black text-on-surface">
                      {batch.product.icon ?? "🍾"}{" "}
                      {batch.product.name}
                    </p>

                    <p className="mt-1 font-mono text-sm text-on-surface-variant">
                      {bottle.code}
                    </p>

                    <p className="mt-2 text-sm text-outline">
                      Lote: {batch.code}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="font-black text-on-surface">
                      {formatDate(bottle.expirationDate)}
                    </p>

                    <Link
                      href={`/liquors/bottles/${bottle.id}`}
                      className="mt-2 inline-flex text-sm font-black text-on-surface-variant"
                    >
                      Ver botella →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function formatDate(value: Date | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(value);
}