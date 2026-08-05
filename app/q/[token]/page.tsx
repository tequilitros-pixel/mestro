import { notFound } from "next/navigation";
import { LiquorBottleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BottleIcon, CheckIcon, AlertIcon } from "@/components/ui/icons";

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
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-primary/25 bg-surface-container shadow-2xl">
        <header className="bg-surface-container-high p-6 text-center sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-outline-variant bg-surface-container-highest text-5xl">
            {product.icon ?? <BottleIcon className="h-10 w-10 text-on-surface-variant" />}
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-on-surface-variant">
            Casa Destiladora del Norte
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            {product.name}
          </h1>

          <p className="mt-3 font-mono text-xl font-black text-primary">
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
            <section className="mt-6 rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
              <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-outline">
                Descripción del producto
              </p>

              <p className="mt-3 leading-7 text-on-surface-variant">
                {product.description}
              </p>
            </section>
          ) : null}

          <section className="mt-6 rounded-2xl border border-outline-variant bg-surface-container-high/40 p-5">
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
              Trazabilidad
            </p>

            <p className="mt-3 leading-7 text-on-surface-variant">
              Esta botella fue registrada individualmente durante el
              proceso de embotellado. Su lote, número de serie y código
              digital permiten comprobar su origen dentro de nuestro
              sistema operativo.
            </p>
          </section>

          <footer className="mt-8 border-t border-outline-variant pt-6 text-center">
            <p className="font-black text-on-surface">
              Casa Destiladora del Norte
            </p>

            <p className="mt-2 text-sm text-outline">
              Certificado digital administrado por Destiladora del Norte
            </p>

            <p className="mt-3 font-mono text-xs text-outline">
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
      <section className="rounded-3xl border border-error/30 bg-error/10 p-6 text-center sm:p-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-error/40 bg-error/15">
          <AlertIcon className="h-10 w-10 text-error" />
        </div>

        <p className="mt-5 text-sm font-black uppercase tracking-[0.25em] text-error">
          Producto fuera de circulación
        </p>

        <h2 className="mt-3 text-2xl font-black text-on-surface">
          Botella retirada
        </h2>

        <p className="mx-auto mt-3 max-w-xl leading-7 text-on-surface-variant">
          Esta botella existe en el sistema, pero fue marcada como
          retirada o merma. No debe considerarse disponible para venta.
        </p>

        <CertificateCode value={authenticityCode} />
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-gradient-to-br from-tertiary-fixed-dim/15 via-tertiary-fixed-dim/5 to-surface-dim p-6 text-center sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-tertiary-fixed-dim/10 blur-3xl" />

      <div className="relative">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-tertiary-fixed-dim/50 bg-tertiary-fixed-dim/15 shadow-xl shadow-tertiary-fixed-dim/20">
          <CheckIcon className="h-12 w-12 text-tertiary-fixed-dim" />
        </div>

        <p className="mt-5 text-sm font-black uppercase tracking-[0.3em] text-tertiary-fixed-dim">
          Certificado de autenticidad
        </p>

        <h2 className="mt-3 text-3xl font-black text-on-surface sm:text-4xl">
          Botella original
        </h2>

        <p className="mx-auto mt-4 max-w-xl leading-7 text-on-surface-variant">
          El código escaneado corresponde a una botella registrada por
          Casa Destiladora del Norte dentro de su sistema operativo.
        </p>

        <CertificateCode value={authenticityCode} />
      </div>
    </section>
  );
}

function CertificateCode({ value }: { value: string }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-background/60 px-4 py-4">
      <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-outline">
        Código de autenticidad
      </p>

      <p className="mt-2 break-all font-mono text-lg font-black tracking-wider text-on-surface">
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
    <div className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
      <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-outline">
        {label}
      </p>

      <p className="mt-3 break-words text-lg font-black text-on-surface">
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
      return "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim";

    case LiquorBottleStatus.RESERVADA:
      return "border-secondary/30 bg-secondary/10 text-secondary";

    case LiquorBottleStatus.VENDIDA:
      return "border-on-surface-variant/30 bg-on-surface-variant/10 text-on-surface-variant";

    case LiquorBottleStatus.MERMA:
      return "border-error/30 bg-error/10 text-error";

    case LiquorBottleStatus.RETIRADA:
      return "border-error/30 bg-error/10 text-error";

    default:
      return "border-outline-variant bg-surface-container-high text-on-surface-variant";
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