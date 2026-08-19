"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon, WalletIcon, ClockIcon, StoreIcon } from "@/components/ui/icons";
import { PageHeader, StatusBadge } from "@/components/ui/CompactUI";

/*
 * Pantalla del cajero (ENCARGADO). Solo tiene dos estados posibles.
 * Nunca recibe historial: el Server Component que la monta consulta
 * con el alcance ya acotado, asi que ni el HTML ni las props traen
 * cortes ajenos o cerrados.
 */

type CorteAbierto = {
  id: string;
  code: string;
  openedAt: string;
  branchName: string;
  responsibleName: string;
  totalSales: number | null;
  startingFund: number | null;
};

const money = (n: number | null | undefined) =>
  typeof n === "number"
    ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
    : "—";

function tiempoTranscurrido(desde: string, ahora: number) {
  const ms = Math.max(0, ahora - new Date(desde).getTime());
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

export default function CajaOperativa({
  corte,
  branchName,
  userName,
}: {
  corte: CorteAbierto | null;
  branchName: string | null;
  userName: string;
}) {
  // El reloj vive en el cliente solo para mostrar el tiempo transcurrido.
  // La hora que se guarda al abrir o cerrar siempre es la del servidor.
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const hoy = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (!branchName) {
    return (
      <main className="page-frame max-w-2xl space-y-4">
        <PageHeader title="Cortes de caja" />
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
          <p className="text-sm text-on-surface">No tienes una sucursal asignada.</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Pídele a un administrador que te asigne una para poder abrir cortes.
          </p>
        </div>
      </main>
    );
  }

  /* ---------------- ESTADO A: sin corte abierto ---------------- */
  if (!corte) {
    return (
      <main className="page-frame max-w-2xl space-y-4">
        <PageHeader title="Cortes de caja" description={`Hola, ${userName}.`} />

        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <StoreIcon className="h-4 w-4" /> {branchName}
            </span>
            <span className="capitalize">{hoy}</span>
          </div>

          <div className="mt-8 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant">
              <WalletIcon className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-on-surface">No tienes un corte abierto</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Inicia uno para empezar a registrar el movimiento de tu turno.
            </p>

            <Link
              href="/cash-cuts/daily/new"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary transition duration-150 hover:opacity-90 active:scale-[0.98]"
            >
              <PlusIcon className="h-4 w-4" />
              Iniciar corte
            </Link>
          </div>

          <div className="mt-8 border-t border-outline-variant pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Vas a necesitar
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-on-surface-variant">
              <li>· El fondo con el que abres la caja.</li>
              <li>· Las ventas del turno por método de pago.</li>
              <li>· Entradas y salidas de efectivo, con su comprobante.</li>
              <li>· El conteo del efectivo al cerrar.</li>
            </ul>
          </div>
        </div>
      </main>
    );
  }

  /* ---------------- ESTADO B: corte abierto ---------------- */
  return (
    <main className="page-frame max-w-2xl space-y-4">
      <PageHeader title="Cortes de caja" description={`Hola, ${userName}.`} />

      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Corte {corte.code}
            </p>
            <h2 className="mt-1 text-xl font-bold text-on-surface">{corte.branchName}</h2>
          </div>
          <StatusBadge tone="success">En curso</StatusBadge>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <div>
            <dt className="text-on-surface-variant">Responsable</dt>
            <dd className="mt-0.5 font-semibold text-on-surface">{corte.responsibleName}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Abierto desde</dt>
            <dd className="mt-0.5 font-semibold text-on-surface">
              {new Date(corte.openedAt).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Tiempo abierto</dt>
            <dd className="mt-0.5 inline-flex items-center gap-1.5 font-semibold text-on-surface">
              <ClockIcon className="h-3.5 w-3.5" />
              {ahora === null ? "—" : tiempoTranscurrido(corte.openedAt, ahora)}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Fondo inicial</dt>
            <dd className="mt-0.5 font-semibold text-on-surface">{money(corte.startingFund)}</dd>
          </div>
        </dl>

        <div className="mt-6 rounded-xl border border-outline-variant bg-surface-container p-4">
          <p className="text-xs text-on-surface-variant">Ventas registradas hasta ahora</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">{money(corte.totalSales)}</p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/cash-cuts/daily/${corte.id}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-on-primary transition duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            Continuar corte
          </Link>
          <Link
            href={`/cash-cuts/daily/${corte.id}#cerrar`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-outline-variant px-5 text-sm font-semibold text-on-surface transition duration-150 hover:bg-surface-container active:scale-[0.98]"
          >
            Cerrar corte
          </Link>
        </div>
      </div>
    </main>
  );
}
