import { notFound } from "next/navigation";
import { LiquorBottleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function PublicBottleTracePage({ params }: Props) {
  const { token } = await params;

  const bottle = await prisma.liquorBottle.findUnique({
    where: {
      qrToken: token,
    },
    select: {
      code: true,
      qrToken: true,
      serialNumber: true,
      status: true,
      bottledAt: true,
      expirationDate: true,
      currentLocation: true,

      bottling: {
        select: {
          bottleSizeMl: true,

          batch: {
            select: {
              code: true,
              productionDate: true,
              expirationDate: true,
              finalAlcohol: true,
              initialAlcohol: true,

              product: {
                select: {
                  name: true,
                  icon: true,
                  description: true,
                  defaultAlcohol: true,
                },
              },

              recipe: {
                select: {
                  targetAlcohol: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!bottle) {
    notFound();
  }

  const batch = bottle.bottling.batch;
  const product = batch.product;

  const alcohol =
    batch.finalAlcohol ??
    batch.initialAlcohol ??
    batch.recipe.targetAlcohol ??
    product.defaultAlcohol;

  const expirationDate =
    bottle.expirationDate ?? batch.expirationDate;

  const statusStyle = getPublicStatusStyle(bottle.status);
  const authenticityCode = createAuthenticityCode(
    bottle.qrToken,
    bottle.serialNumber
  );

  const isCirculating =
    bottle.status !== LiquorBottleStatus.MERMA &&
    bottle.status !== LiquorBottleStatus.RETIRADA;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-purple-500/25 bg-slate-900 shadow-2xl shadow-purple-950/30">
        <header className="bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-slate-900 p-6 text-center sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-purple-400/20 bg-purple-500/10 text-5xl">
            {product.icon ?? "🍾"}
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-purple-300">
            Casa Destiladora del Norte
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            {product.name}
          </h1>

          <p className="mt-3 font-mono text-xl font-black text-purple-200">
            {bottle.code}
          </p>

          <div className="mt-5">
            <span
              className={`inline-flex rounded-full border px-4 py-2 text-sm font-black ${statusStyle}`}
            >
              {getPublicStatusLabel(bottle.status)}
            </span>
          </div>
        </header>

        <div className="p-6 sm:p-8">
          <AuthenticityCertificate
            authenticityCode={authenticityCode}
            isCirculating={isCirculating}
          />

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard
              label="Presentación"
              value={formatBottleSize(
                bottle.bottling.bottleSizeMl
              )}
            />

            <InfoCard
              label="Alcohol"
              value={
                alcohol !== null && alcohol !== undefined
                  ? `${formatNumber(alcohol, 2)}% Alc. Vol.`
                  : "No registrado"
              }
            />

            <InfoCard label="Lote" value={batch.code} />

            <InfoCard
              label="Número de serie"
              value={`#${formatSerialNumber(
                bottle.serialNumber
              )}`}
            />

            <InfoCard
              label="Elaboración"
              value={formatDate(batch.productionDate)}
            />

            <InfoCard
              label="Embotellado"
              value={formatDate(bottle.bottledAt)}
            />

            <InfoCard
              label="Caducidad"
              value={formatDate(expirationDate)}
            />

            <InfoCard
              label="Ubicación registrada"
              value={
                bottle.currentLocation ?? "Almacén principal"
              }
            />
          </section>

          {product.description ? (
            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Descripción del producto
              </p>

              <p className="mt-3 leading-7 text-slate-300">
                {product.description}
              </p>
            </section>
          ) : null}

          <section className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-300">
              Trazabilidad
            </p>

            <p className="mt-3 leading-7 text-slate-300">
              Esta botella fue registrada individualmente durante el
              proceso de embotellado. Su lote, número de serie y código
              digital permiten comprobar su origen dentro de MAESTRO.
            </p>
          </section>

          <footer className="mt-8 border-t border-slate-800 pt-6 text-center">
            <p className="font-black text-white">
              Casa Destiladora del Norte
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Certificado digital administrado por MAESTRO
            </p>

            <p className="mt-3 font-mono text-xs text-slate-600">
              {authenticityCode}
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}

function AuthenticityCertificate({
  authenticityCode,
  isCirculating,
}: {
  authenticityCode: string;
  isCirculating: boolean;
}) {
  if (!isCirculating) {
    return (
      <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center sm:p-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-400/40 bg-red-500/15 text-4xl">
          !
        </div>

        <p className="mt-5 text-sm font-black uppercase tracking-[0.25em] text-red-300">
          Producto fuera de circulación
        </p>

        <h2 className="mt-3 text-2xl font-black text-white">
          Botella retirada
        </h2>

        <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-300">
          Esta botella existe en el sistema, pero fue marcada como
          retirada o merma. No debe considerarse disponible para venta.
        </p>

        <CertificateCode value={authenticityCode} />
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-green-500/5 to-slate-950 p-6 text-center sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-400/50 bg-emerald-500/15 text-5xl shadow-xl shadow-emerald-950/40">
          ✓
        </div>

        <p className="mt-5 text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
          Certificado de autenticidad
        </p>

        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
          Botella original
        </h2>

        <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-300">
          El código escaneado corresponde a una botella registrada por
          Casa Destiladora del Norte dentro del sistema MAESTRO.
        </p>

        <CertificateCode value={authenticityCode} />
      </div>
    </section>
  );
}

function CertificateCode({ value }: { value: string }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        Código de autenticidad
      </p>

      <p className="mt-2 break-all font-mono text-lg font-black tracking-wider text-white">
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-3 break-words text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}

function getPublicStatusLabel(status: LiquorBottleStatus) {
  switch (status) {
    case LiquorBottleStatus.DISPONIBLE:
      return "Producto vigente";

    case LiquorBottleStatus.RESERVADA:
      return "Producto reservado";

    case LiquorBottleStatus.VENDIDA:
      return "Producto vendido";

    case LiquorBottleStatus.MERMA:
      return "Producto fuera de circulación";

    case LiquorBottleStatus.RETIRADA:
      return "Producto retirado";

    default:
      return status;
  }
}

function getPublicStatusStyle(status: LiquorBottleStatus) {
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

function createAuthenticityCode(
  qrToken: string,
  serialNumber: number
) {
  const tokenPart = qrToken
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();

  const serialPart = serialNumber
    .toString()
    .padStart(6, "0");

  return `CDN-${serialPart}-${tokenPart}`;
}

function formatSerialNumber(value: number) {
  return value.toString().padStart(6, "0");
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

function formatDate(value: Date | null) {
  if (!value) {
    return "No registrada";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
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