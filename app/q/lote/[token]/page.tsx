import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgaveIcon, CheckIcon } from "@/components/ui/icons";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function PublicLotTracePage({ params }: Props) {
  const { token } = await params;

  const lot = await prisma.lot.findUnique({
    where: {
      qrToken: token,
    },
    select: {
      code: true,
      stage: true,
      agaveKg: true,
      art: true,
      startedAt: true,
      finishedAt: true,
      totalLitersObtained: true,
      owner: {
        select: {
          name: true,
        },
      },
      distillations: {
        where: {
          type: "RECTIFICACION",
        },
        select: {
          finalAlcohol: true,
          finalLiters: true,
          finishedAt: true,
          closureCode: true,
        },
        orderBy: {
          finishedAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!lot || lot.stage !== "TERMINADO" || !lot.totalLitersObtained) {
    notFound();
  }

  const rectificacion = lot.distillations[0] ?? null;

  const authenticityCode = createAuthenticityCode(lot.code, token);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-primary/25 bg-surface-container shadow-2xl">
        <header className="bg-surface-container-high p-6 text-center sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-outline-variant bg-surface-container-highest">
            <AgaveIcon className="h-10 w-10 text-on-surface-variant" />
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-on-surface-variant">
            Casa Destiladora del Norte
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Lote {lot.code}
          </h1>

          <div className="mt-5">
            <span className="inline-flex rounded-full border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 px-4 py-2 text-sm font-black text-tertiary-fixed-dim">
              Producción terminada
            </span>
          </div>
        </header>

        <div className="p-6 sm:p-8">
          <section className="relative overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-gradient-to-br from-tertiary-fixed-dim/15 via-tertiary-fixed-dim/5 to-surface-dim p-6 text-center sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-tertiary-fixed-dim/10 blur-3xl" />

            <div className="relative">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-tertiary-fixed-dim/50 bg-tertiary-fixed-dim/15 shadow-xl shadow-tertiary-fixed-dim/20">
                <CheckIcon className="h-12 w-12 text-tertiary-fixed-dim" />
              </div>

              <p className="mt-5 text-sm font-black uppercase tracking-[0.3em] text-tertiary-fixed-dim">
                Certificado de trazabilidad
              </p>

              <h2 className="mt-3 text-3xl font-black text-on-surface sm:text-4xl">
                Lote original
              </h2>

              <p className="mx-auto mt-4 max-w-xl leading-7 text-on-surface-variant">
                Este código corresponde a un lote de producción
                registrado por Casa Destiladora del Norte dentro de su
                sistema operativo, desde la recepción del agave hasta la
                destilación final.
              </p>

              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-background/60 px-4 py-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-outline">
                  Código de autenticidad
                </p>

                <p className="mt-2 break-all font-mono text-lg font-black tracking-wider text-on-surface">
                  {authenticityCode}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard label="Agave procesado" value={`${formatNumber(lot.agaveKg)} kg`} />

            <InfoCard
              label="Litros totales obtenidos"
              value={`${formatNumber(lot.totalLitersObtained)} L`}
            />

            <InfoCard
              label="Alcohol final"
              value={
                rectificacion?.finalAlcohol !== null &&
                rectificacion?.finalAlcohol !== undefined
                  ? `${formatNumber(rectificacion.finalAlcohol)} % Alc. Vol.`
                  : "No registrado"
              }
            />

            <InfoCard
              label="Folio de cierre"
              value={rectificacion?.closureCode ?? "No registrado"}
            />

            <InfoCard label="Inicio del proceso" value={formatDate(lot.startedAt)} />

            <InfoCard label="Fin del proceso" value={formatDate(lot.finishedAt)} />

            <InfoCard label="Responsable del lote" value={lot.owner.name} />

            <InfoCard
              label="ART"
              value={lot.art !== null ? `${formatNumber(lot.art)}` : "No registrado"}
            />
          </section>

          <section className="mt-6 rounded-2xl border border-outline-variant bg-primary/5 p-5">
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
              Trazabilidad
            </p>

            <p className="mt-3 leading-7 text-on-surface-variant">
              Este lote recorrió todo el proceso productivo — cocción,
              molienda, fermentación y destilación — dentro del
              sistema operativo de Casa Destiladora del Norte.
            </p>
          </section>

          <footer className="mt-8 border-t border-outline-variant pt-6 text-center">
            <p className="font-black text-on-surface">Casa Destiladora del Norte</p>

            <p className="mt-2 text-sm text-outline">
              Certificado digital administrado por Destiladora del Norte
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
      <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-outline">
        {label}
      </p>

      <p className="mt-3 break-words text-lg font-black text-on-surface">{value}</p>
    </div>
  );
}

function createAuthenticityCode(lotCode: string, token: string) {
  const tokenPart = token
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();

  return `CDN-${lotCode}-${tokenPart}`;
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

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}
