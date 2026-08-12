"use client";

import { useState, useEffect, useRef } from "react";
import {
  getMyOpenShift,
  getMyBranches,
  getNearbyBranches,
  clockInAction,
  clockOutAction,
  getMyTimeClockSummary,
  reportGeofenceAlert,
} from "@/app/actions/timeclock";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { ClockIcon, DollarIcon, LoginIcon, LogoutIcon } from "@/components/ui/icons";
import { distanceMeters, hasGeofence, type BranchLocation } from "@/lib/geo";
import { enqueueOperation } from "@/lib/offline/queue";

type Branch = BranchLocation & { id: string; name: string };
type OpenShift = {
  id: string;
  clockIn: string | Date;
  branch: Branch;
};
type Summary = {
  hourlyRate: number | null;
  hasOpenShift: boolean;
  todayHours: number;
  weekHours: number;
  todayPay: number | null;
  weekPay: number | null;
};
type OutOfRange = { distance: number; radius: number } | null;

function formatHours(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Este navegador no soporta geolocalización."));
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
    if (code === 1) return "Activa el permiso de ubicación en tu navegador para poder checar.";
    if (code === 2) return "No se pudo determinar tu ubicación. Intenta de nuevo.";
    if (code === 3) return "Se agotó el tiempo esperando tu ubicación. Intenta de nuevo.";
  }
  return err instanceof Error ? err.message : "No se pudo obtener tu ubicación.";
}

export default function ClockWidget() {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfRange, setOutOfRange] = useState<OutOfRange>(null);

  const [confirming, setConfirming] = useState(false);
  const [clockInValue, setClockInValue] = useState("");
  const [clockOutValue, setClockOutValue] = useState("");

  const [detectedIds, setDetectedIds] = useState<Set<string>>(new Set());
  const [nearbyChecked, setNearbyChecked] = useState(false);

  const lastAlertRef = useRef(0);

  async function load() {
    setLoading(true);
    try {
      const [shift, myBranches, summaryResult] = await Promise.all([
        getMyOpenShift(),
        getMyBranches(),
        getMyTimeClockSummary(),
      ]);
      setOpenShift(shift as OpenShift | null);
      setBranches(myBranches);
      localStorage.setItem("maestro:timeclock-branches", JSON.stringify(myBranches));
      if (shift) localStorage.setItem("maestro:timeclock-open-shift", JSON.stringify(shift));
      else localStorage.removeItem("maestro:timeclock-open-shift");
      if (myBranches.length > 0) setSelectedBranch(myBranches[0].id);
      if ("success" in summaryResult) setSummary(summaryResult as Summary);
    } catch {
      const cachedBranches = localStorage.getItem("maestro:timeclock-branches");
      const cachedShift = localStorage.getItem("maestro:timeclock-open-shift");
      if (cachedBranches) setBranches(JSON.parse(cachedBranches) as Branch[]);
      if (cachedShift) setOpenShift(JSON.parse(cachedShift) as OpenShift);
    }
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  // Además de las sucursales asignadas o con turno programado, detecta
  // en segundo plano si el empleado está físicamente dentro de la
  // geozona de otra sucursal activa (p. ej. cubriendo Vélez sin tenerla
  // asignada) y se la ofrece para checar entrada. Es silencioso: si no
  // hay permiso de ubicación o falla, simplemente no agrega nada.
  useEffect(() => {
    if (loading || openShift) return;
    if (!("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNearbyChecked(true);
      return;
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;

        const nearby = await getNearbyBranches({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        if (cancelled) return;

        if (nearby.length > 0) {
          setBranches((prev) => {
            const byId = new Map(prev.map((b) => [b.id, b]));
            for (const b of nearby) {
              if (!byId.has(b.id)) byId.set(b.id, b as Branch);
            }
            return Array.from(byId.values());
          });

          setDetectedIds((prev) => {
            const next = new Set(prev);
            for (const b of nearby) next.add(b.id);
            return next;
          });

          setSelectedBranch((prev) => prev || nearby[0].id);
        }

        setNearbyChecked(true);
      },
      () => {
        // La detección por geozona es un plus, no un requisito: si el
        // navegador no da permiso o falla, seguimos con lo asignado.
        if (!cancelled) setNearbyChecked(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );

    return () => {
      cancelled = true;
    };
  }, [loading, openShift]);

  // Mientras haya un turno abierto, refresca cada minuto para que
  // las horas y el dinero ganado del día avancen solos.
  useEffect(() => {
    if (!openShift) return;

    const interval = setInterval(() => {
      if (navigator.onLine) load();
    }, 60_000);

    return () => clearInterval(interval);
  }, [openShift]);

  // Mientras haya un turno abierto en una sucursal con geocerca,
  // vigila la ubicación en segundo plano. Si se sale del radio
  // permitido, muestra un aviso y registra la alerta para el admin.
  useEffect(() => {
    if (!openShift) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOutOfRange(null);
      return;
    }

    const branch = openShift.branch;
    if (!hasGeofence(branch) || !("geolocation" in navigator)) {
      setOutOfRange(null);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const distance = distanceMeters(
          branch.geofence.latitude,
          branch.geofence.longitude,
          position.coords.latitude,
          position.coords.longitude
        );

        if (distance > branch.geofence.radius) {
          setOutOfRange({
            distance: Math.round(distance),
            radius: branch.geofence.radius,
          });

          const now = Date.now();
          if (now - lastAlertRef.current > 60_000) {
            lastAlertRef.current = now;
            reportGeofenceAlert(openShift.id, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        } else {
          setOutOfRange(null);
        }
      },
      () => {
        // Si falla el rastreo en segundo plano no interrumpimos al
        // empleado; la ubicación se vuelve a pedir al checar salida.
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [openShift]);

  async function handleClockIn() {
    if (!selectedBranch) {
      setError("Selecciona una sucursal.");
      return;
    }

    const branch = branches.find((b) => b.id === selectedBranch);

    setError(null);

    let coords: { latitude: number; longitude: number } | undefined;

    if (branch && hasGeofence(branch)) {
      setLocating(true);
      try {
        const position = await getCurrentPosition();
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      } catch (err) {
        setLocating(false);
        setError(friendlyGeoError(err));
        return;
      }
      setLocating(false);
    }

    setSaving(true);
    if (!navigator.onLine) {
      const id = crypto.randomUUID();
      const clockIn = new Date();
      await enqueueOperation({ id, kind: "timeclock.clock-in", createdAt: clockIn.toISOString(), payload: { branchId: selectedBranch, clockIn: clockIn.toISOString(), coords } });
      if (branch) {
        const localShift = { id, clockIn, branch };
        setOpenShift(localShift);
        localStorage.setItem("maestro:timeclock-open-shift", JSON.stringify(localShift));
      }
      setSaving(false);
      return;
    }
    const result = await clockInAction(selectedBranch, coords);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    await load();
  }

  function startConfirming() {
    if (!openShift) return;
    setClockInValue(toDatetimeLocal(new Date(openShift.clockIn)));
    setClockOutValue(toDatetimeLocal(new Date()));
    setConfirming(true);
  }

  async function handleConfirmClockOut() {
    if (!openShift) return;

    setError(null);

    let coords: { latitude: number; longitude: number } | undefined;

    if (hasGeofence(openShift.branch)) {
      setLocating(true);
      try {
        const position = await getCurrentPosition();
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      } catch (err) {
        setLocating(false);
        setError(friendlyGeoError(err));
        return;
      }
      setLocating(false);
    }

    setSaving(true);
    if (!navigator.onLine) {
      const clockOut = new Date(clockOutValue);
      await enqueueOperation({ id: crypto.randomUUID(), kind: "timeclock.clock-out", createdAt: new Date().toISOString(), payload: { entryId: openShift.id, clockOut: clockOut.toISOString(), coords } });
      setOpenShift(null);
      localStorage.removeItem("maestro:timeclock-open-shift");
      setConfirming(false);
      setSaving(false);
      return;
    }
    const result = await clockOutAction(openShift.id, clockInValue, clockOutValue, coords);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setConfirming(false);
    await load();
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-center text-on-surface-variant">
        Cargando...
      </div>
    );
  }

  if (branches.length === 0 && !openShift && !nearbyChecked) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-center text-on-surface-variant">
        Buscando sucursales cercanas...
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-6 text-center text-secondary">
        No tienes ninguna sucursal asignada ni turno programado para hoy, y no
        detectamos que estés dentro del área de alguna sucursal. Pídele a un
        administrador que te asigne una en Personal, o acércate a la
        sucursal donde vas a trabajar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardLabel>
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" />
                Horas hoy
              </span>
            </CardLabel>
            <CardValue>{formatHours(summary.todayHours)}</CardValue>
          </Card>

          <Card>
            <CardLabel>
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" />
                Horas esta semana
              </span>
            </CardLabel>
            <CardValue>{formatHours(summary.weekHours)}</CardValue>
          </Card>

          <div className="col-span-2">
            <Card highlight>
              <CardLabel>
                <span className="inline-flex items-center gap-1.5">
                  <DollarIcon className="h-3.5 w-3.5" />
                  Ganado esta semana
                </span>
              </CardLabel>
              <CardValue>
                {summary.hourlyRate !== null && summary.weekPay !== null
                  ? formatCurrency(summary.weekPay)
                  : "—"}
              </CardValue>
              {summary.hourlyRate === null && (
                <p className="mt-1 text-xs text-on-surface-variant">
                  Pídele a un administrador que configure tu pago por hora.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {outOfRange && !confirming && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          Saliste del área de la sucursal: estás a {outOfRange.distance} m
          (máximo {outOfRange.radius} m). Vuelve al área para poder checar
          salida.
        </div>
      )}

      {!openShift ? (
        <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-6">
          <p className="text-sm text-on-surface-variant">Selecciona tu sucursal de hoy:</p>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {detectedIds.has(b.id) ? " (detectada por tu ubicación)" : ""}
              </option>
            ))}
          </select>

          {selectedBranch && detectedIds.has(selectedBranch) && (
            <p className="text-xs text-on-surface-variant">
              No tienes esta sucursal asignada, pero detectamos que estás en
              su área. Puedes checar entrada aquí.
            </p>
          )}

          <button
            onClick={handleClockIn}
            disabled={saving || locating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-tertiary-fixed-dim py-4 text-lg font-bold text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
          >
            {locating ? (
              "Ubicándote..."
            ) : saving ? (
              "Registrando..."
            ) : (
              <>
                <LoginIcon className="h-5 w-5" />
                Checar entrada
              </>
            )}
          </button>
        </div>
      ) : !confirming ? (
        <div className="space-y-4 rounded-2xl border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 p-6 text-center">
          <p className="text-sm text-tertiary-fixed-dim">
            Trabajando en <strong>{openShift.branch.name}</strong>
          </p>
          <p className="text-2xl font-bold text-on-surface">
            Desde las{" "}
            {new Date(openShift.clockIn).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          <button
            onClick={startConfirming}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-error py-4 text-lg font-bold text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
          >
            <LogoutIcon className="h-5 w-5" />
            Checar salida
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-6">
          <h3 className="text-lg font-bold text-on-surface">Confirma tu horario</h3>
          <p className="text-sm text-on-surface-variant">
            Revisa que las horas sean correctas antes de confirmar.
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Entrada</span>
            <input
              type="datetime-local"
              value={clockInValue}
              onChange={(e) => setClockInValue(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Salida</span>
            <input
              type="datetime-local"
              value={clockOutValue}
              onChange={(e) => setClockOutValue(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </label>

          <div className="flex gap-3">
            <button
              onClick={handleConfirmClockOut}
              disabled={saving || locating}
              className="flex-1 rounded-xl bg-tertiary-fixed-dim py-3 font-bold text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
            >
              {locating ? "Ubicándote..." : saving ? "Guardando..." : "Confirmar"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-xl border border-outline-variant px-4 py-3 text-on-surface-variant hover:border-outline-variant"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
