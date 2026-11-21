"use client";

import { useEffect, useState } from "react";
import {
  getKioskBranches,
  getKioskEmployees,
  kioskClockInAction,
  kioskClockOutAction,
  type KioskEmployee,
} from "@/app/actions/kiosk";
import { ClockIcon, LoginIcon, LogoutIcon, XIcon } from "@/components/ui/icons";
import { getInitials } from "@/lib/personnelRoles";

type Branch = { id: string; name: string };

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Este dispositivo no soporta geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

function friendlyGeoError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: number }).code;
    if (code === 1) return "Activa el permiso de ubicación en este dispositivo para usar el kiosco.";
    if (code === 2) return "No se pudo determinar la ubicación. Intenta de nuevo.";
    if (code === 3) return "Se agotó el tiempo esperando la ubicación. Intenta de nuevo.";
  }
  return err instanceof Error ? err.message : "No se pudo obtener la ubicación.";
}

type Step =
  | { name: "locating" }
  | { name: "locationError"; message: string }
  | { name: "pickBranch"; branches: Branch[] }
  | { name: "noBranch" }
  | { name: "employees"; branch: Branch }
  | { name: "pin"; branch: Branch; employee: KioskEmployee };

export default function KioskClient() {
  const [step, setStep] = useState<Step>({ name: "locating" });
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [employees, setEmployees] = useState<KioskEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentPosition()
      .then(async (pos) => {
        if (cancelled) return;
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setCoords(c);

        const branches = await getKioskBranches(c);
        if (cancelled) return;

        if (branches.length === 0) {
          setStep({ name: "noBranch" });
        } else if (branches.length === 1) {
          setStep({ name: "employees", branch: branches[0] });
        } else {
          setStep({ name: "pickBranch", branches });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStep({ name: "locationError", message: friendlyGeoError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step.name !== "employees") return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingEmployees(true);

    getKioskEmployees(step.branch.id).then((result) => {
      if (cancelled) return;
      setEmployees(result);
      setLoadingEmployees(false);
    });

    return () => {
      cancelled = true;
    };
  }, [step]);

  function selectBranch(branch: Branch) {
    setStep({ name: "employees", branch });
  }

  function selectEmployee(branch: Branch, employee: KioskEmployee) {
    setPin("");
    setError(null);
    setStep({ name: "pin", branch, employee });
  }

  function backToEmployees(branch: Branch) {
    setPin("");
    setError(null);
    setStep({ name: "employees", branch });
  }

  async function submitPin(branch: Branch, employee: KioskEmployee, pinValue: string) {
    setBusy(true);
    setError(null);

    const result = employee.hasOpenShift
      ? await kioskClockOutAction(employee.id, pinValue, coords ?? undefined)
      : await kioskClockInAction(employee.id, pinValue, branch.id, coords ?? undefined);

    setBusy(false);

    if (result?.error) {
      setError(result.error);
      setPin("");
      return;
    }

    setSuccessMessage(
      employee.hasOpenShift
        ? `Hasta luego, ${result.employeeName?.split(" ")[0] ?? employee.name}`
        : `Bienvenido, ${result.employeeName?.split(" ")[0] ?? employee.name}`,
    );

    setTimeout(() => {
      setSuccessMessage(null);
      backToEmployees(branch);
    }, 1800);
  }

  function handleDigit(branch: Branch, employee: KioskEmployee, digit: string) {
    if (busy || successMessage) return;
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      submitPin(branch, employee, next);
    }
  }

  function handleBackspace() {
    if (busy || successMessage) return;
    setPin((p) => p.slice(0, -1));
  }

  if (step.name === "locating") {
    return <CenteredMessage title="Ubicando el dispositivo..." subtitle="Activa el GPS si te lo pide." />;
  }

  if (step.name === "locationError") {
    return (
      <CenteredMessage title="No se pudo ubicar el dispositivo" subtitle={step.message}>
        <button
          onClick={() => setStep({ name: "locating" })}
          className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary"
        >
          Reintentar
        </button>
      </CenteredMessage>
    );
  }

  if (step.name === "noBranch") {
    return (
      <CenteredMessage
        title="Este dispositivo no está dentro de ninguna sucursal"
        subtitle="El kiosco solo funciona dentro del área de una sucursal con geozona configurada."
      >
        <button
          onClick={() => setStep({ name: "locating" })}
          className="mt-4 rounded-xl border border-outline-variant px-5 py-3 text-sm font-bold text-on-surface-variant"
        >
          Reintentar
        </button>
      </CenteredMessage>
    );
  }

  if (step.name === "pickBranch") {
    return (
      <CenteredMessage title="¿En qué sucursal está este dispositivo?" subtitle="Detectamos más de una cerca.">
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {step.branches.map((b) => (
            <button
              key={b.id}
              onClick={() => selectBranch(b)}
              className="rounded-xl border border-outline-variant bg-surface-container px-5 py-3 text-sm font-bold text-on-surface hover:border-primary/40 hover:bg-primary/5"
            >
              {b.name}
            </button>
          ))}
        </div>
      </CenteredMessage>
    );
  }

  if (step.name === "employees") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            Checador — {step.branch.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">Toca tu nombre</h1>
        </div>

        {loadingEmployees ? (
          <p className="mt-8 text-center text-sm text-on-surface-variant">Cargando...</p>
        ) : employees.length === 0 ? (
          <p className="mt-8 text-center text-sm text-on-surface-variant">
            Nadie tiene PIN configurado para esta sucursal todavía. Pide a un administrador que te
            asigne uno en Personal.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {employees.map((employee) => (
              <button
                key={employee.id}
                onClick={() => selectEmployee(step.branch, employee)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container p-4 transition hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-black text-primary">
                  {getInitials(employee.name)}
                </span>
                <span className="text-center text-sm font-semibold text-on-surface">
                  {employee.name}
                </span>
                {employee.hasOpenShift ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
                    <LogoutIcon className="h-3 w-3" />
                    Salida
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed-dim/15 px-2 py-0.5 text-[10px] font-bold text-tertiary-fixed-dim">
                    <LoginIcon className="h-3 w-3" />
                    Entrada
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // step.name === "pin"
  const { branch, employee } = step;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-8">
      <button
        onClick={() => backToEmployees(branch)}
        className="mb-4 inline-flex items-center gap-1.5 self-start text-xs font-bold text-on-surface-variant"
      >
        <XIcon className="h-3.5 w-3.5" />
        Cancelar
      </button>

      {successMessage ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <ClockIcon className="h-10 w-10 text-tertiary-fixed-dim" />
          <p className="text-lg font-bold text-on-surface">{successMessage}</p>
        </div>
      ) : (
        <>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-black text-primary">
            {getInitials(employee.name)}
          </span>
          <p className="mt-3 text-lg font-bold text-on-surface">{employee.name}</p>
          <p className="text-xs text-on-surface-variant">
            {employee.hasOpenShift ? "Captura tu PIN para salir" : "Captura tu PIN para entrar"}
          </p>

          <div className="mt-5 flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full border-2 ${
                  i < pin.length ? "border-primary bg-primary" : "border-outline-variant"
                }`}
              />
            ))}
          </div>

          {error && <p className="mt-3 text-sm font-semibold text-error">{error}</p>}
          {busy && <p className="mt-3 text-sm text-on-surface-variant">Verificando...</p>}

          <div className="mt-6 grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => handleDigit(branch, employee, d)}
                disabled={busy}
                className="h-16 w-16 rounded-2xl border border-outline-variant bg-surface-container text-xl font-bold text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              onClick={() => handleDigit(branch, employee, "0")}
              disabled={busy}
              className="h-16 w-16 rounded-2xl border border-outline-variant bg-surface-container text-xl font-bold text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={busy}
              className="h-16 w-16 rounded-2xl border border-outline-variant bg-surface-container text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-50"
            >
              ⌫
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CenteredMessage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-on-surface">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>}
      {children}
    </div>
  );
}
