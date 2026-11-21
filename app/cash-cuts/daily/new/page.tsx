"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import DenominationWizard from "@/components/cash-cuts/DenominationWizard";
import type { CashDenominationCount } from "@/lib/cash-cuts/denominations";
import { enqueueOperation } from "@/lib/offline/queue";
import { todayDateOnly } from "@/lib/dateOnly";
import { formatBusinessDate } from "@/lib/dateTime";

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface StockWarning {
  product: string;
  required: number;
  available: number;
  missing: number;
  unit: string;
  note?: string;
}

interface EligibleEvent {
  id: string;
  code: string;
  clientName: string;
  location: string;
  eventDate: string;
  guestCount: number;
  status: string;
  _count: { items: number };
}

const formatEventDate = (iso: string) =>
  formatBusinessDate(iso, { day: "numeric", month: "short" });

export default function NuevoCortePage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(todayDateOnly);
  const [counting, setCounting] = useState(false);
  const [events, setEvents] = useState<EligibleEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedCut, setOpenedCut] = useState<{ id: string; warnings: StockWarning[] } | null>(null);
  // Reutilizar la misma clave ante doble toque, reintento o corte ya creado.
  const openingOperationId = useRef<string | null>(null);

  useEffect(() => {
    const cachedBranches = localStorage.getItem("maestro:cash-cut-branches");
    if (cachedBranches) {
      window.setTimeout(() => setBranches(JSON.parse(cachedBranches)), 0);
    }
    fetch("/api/branches/accessible")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las sucursales.");
        return data.branches as Branch[];
      })
      .then((data) => {
        setBranches(data);
        localStorage.setItem("maestro:cash-cut-branches", JSON.stringify(data));
        if (data.length === 1) setBranchId(data[0].id);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las sucursales.");
      });

    fetch("/api/cash-cuts/events")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, []);

  async function openCashCut(total: number, breakdown: CashDenominationCount[]) {
    setError(null);

    if (!branchId) {
      setError("Selecciona la sucursal.");
      return;
    }

    setLoading(true);
    const operationId = openingOperationId.current ?? crypto.randomUUID();
    openingOperationId.current = operationId;
    const payload = {
      clientOperationId: operationId,
      branchId,
      date,
      startingFund: total,
      startingFundDenominations: breakdown,
      eventId: eventId || undefined,
    };
    if (!navigator.onLine) {
      if (eventId) {
        setError("La apertura vinculada a un evento requiere conexión para validar inventario.");
        setLoading(false);
        return;
      }
      const id = operationId;
      const branch = branches.find((item) => item.id === branchId)!;
      await enqueueOperation({ id, kind: "cash-cut.open", payload, createdAt: new Date().toISOString() });
      localStorage.setItem(`maestro:cash-cut:${id}`, JSON.stringify({
        id,
        code: `CC-${branch.code}-PENDIENTE`,
        status: "ABIERTO",
        startingFund: total,
        branch: { id: branch.id, name: branch.name },
        salesByMethod: [], outflows: [], inflows: [], evidences: [], denominations: [],
        cashCounted: null, cashExpected: null, difference: null, envelopeAmount: null,
        envelopeNumber: null, nextFund: null, event: null,
      }));
      localStorage.setItem(`maestro:open-cash-cut:${branchId}`, id);
      router.push(`/cash-cuts/daily/${id}`);
      return;
    }
    try {
      const res = await fetch("/api/cash-cuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const cashCut = await res.json();
      if (!res.ok) {
        setError(cashCut.error ?? "No se pudo abrir el corte");
        return;
      }
      const warnings: StockWarning[] = Array.isArray(cashCut.stockWarnings) ? cashCut.stockWarnings : [];
      if (eventId && warnings.length) {
        setOpenedCut({ id: cashCut.id, warnings });
      } else {
        router.push(`/cash-cuts/daily/${cashCut.id}`);
      }
    } catch {
      setError("No se pudo abrir el corte. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold text-on-surface mb-1">Iniciar caja</h1>
      <p className="text-on-surface-variant text-sm mb-6">
        Abre el turno contando el fondo de caja billete por billete.
      </p>

      {!counting ? <div className="space-y-4">
        <Card>
          <CardLabel>Sucursal</CardLabel>
          <select
            value={branchId}
            onChange={(e) => { openingOperationId.current = null; setBranchId(e.target.value); }}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="">Selecciona...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Card>

        <Card>
          <CardLabel>Fecha</CardLabel>
          <input
            type="date"
            value={date}
            onChange={(e) => { openingOperationId.current = null; setDate(e.target.value); }}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </Card>

        {events.length > 0 && (
          <Card>
            <CardLabel>Evento (opcional)</CardLabel>
            <p className="mb-2 text-xs text-on-surface-variant">
              Vincula el corte al evento. Las ventas consumirán sus productos,
              sin descontar otra vez del inventario de la sucursal.
            </p>
            <select
              value={eventId}
              onChange={(e) => { openingOperationId.current = null; setEventId(e.target.value); }}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="">Ninguno</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {formatEventDate(ev.eventDate)} · {ev.clientName} (
                  {ev._count.items} productos)
                </option>
              ))}
            </select>
          </Card>
        )}

        {error && <p className="text-error text-sm">{error}</p>}

        <Button type="button" size="lg" className="w-full" onClick={() => {
          if (!branchId) { setError("Selecciona la sucursal."); return; }
          setError(null);
          setCounting(true);
        }}>
          Contar fondo inicial
        </Button>
      </div> : (
        <DenominationWizard
          title="Fondo inicial"
          description="Captura una denominación a la vez. Puedes escribir 0 y continuar."
          confirmLabel="Confirmar e iniciar caja"
          busy={loading}
          onConfirm={openCashCut}
        />
      )}
      {counting && error && <p className="mt-4 text-sm text-error">{error}</p>}

      {openedCut && (
        <div role="dialog" aria-modal="true" aria-labelledby="event-stock-warning-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-outline-variant bg-surface p-5 shadow-2xl">
            <div>
              <p className="text-sm font-semibold text-amber-500">Corte abierto correctamente</p>
              <h2 id="event-stock-warning-title" className="mt-1 text-xl font-bold text-on-surface">
                ¿Te hacen falta estos productos para trabajar?
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                El inventario de la sucursal muestra diferencias frente a lo cargado para este evento.
                Es una advertencia: puedes continuar vendiendo y revisar los faltantes después.
              </p>
            </div>
            <ul className="max-h-60 space-y-2 overflow-y-auto rounded-xl bg-surface-container p-3 text-sm">
              {openedCut.warnings.map((item, index) => (
                <li key={`${item.product}-${index}`} className="flex justify-between gap-3 border-b border-outline-variant pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-medium text-on-surface">{item.product}</span>
                    {item.note && <p className="text-xs text-on-surface-variant">{item.note}</p>}
                  </div>
                  <span className="shrink-0 font-semibold text-amber-500">
                    {item.missing > 0 ? `Faltan ${item.missing.toLocaleString("es-MX")} ${item.unit}` : "Revisar"}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" autoFocus onClick={() => router.push(`/cash-cuts/daily/${openedCut.id}`)} className="min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-on-primary">
              Aceptar y continuar al corte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
