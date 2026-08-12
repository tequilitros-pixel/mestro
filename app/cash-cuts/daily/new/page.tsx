"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import DenominationCounter, {
  type DenominationCount,
} from "@/components/cash-cuts/DenominationCounter";
import { enqueueOperation } from "@/lib/offline/queue";

interface Branch {
  id: string;
  name: string;
  code: string;
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
  new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });

export default function NuevoCortePage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startingFund, setStartingFund] = useState("");
  const [startingFundBreakdown, setStartingFundBreakdown] = useState<
    DenominationCount[]
  >([]);
  const [events, setEvents] = useState<EligibleEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedBranches = localStorage.getItem("maestro:cash-cut-branches");
    if (cachedBranches) {
      window.setTimeout(() => setBranches(JSON.parse(cachedBranches)), 0);
    }
    fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => {
        setBranches(data);
        localStorage.setItem("maestro:cash-cut-branches", JSON.stringify(data));
        if (data.length === 1) setBranchId(data[0].id);
      });

    fetch("/api/cash-cuts/events")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!branchId || startingFund === "") {
      setError("Selecciona la sucursal y captura el fondo de caja.");
      return;
    }

    setLoading(true);
    const payload = {
      branchId,
      date,
      startingFund: Number(startingFund),
      startingFundDenominations: startingFundBreakdown,
      eventId: eventId || undefined,
    };
    if (!navigator.onLine) {
      if (eventId) {
        setError("La apertura vinculada a un evento requiere conexión para validar inventario.");
        setLoading(false);
        return;
      }
      const id = crypto.randomUUID();
      const branch = branches.find((item) => item.id === branchId)!;
      await enqueueOperation({ id, kind: "cash-cut.open", payload, createdAt: new Date().toISOString() });
      localStorage.setItem(`maestro:cash-cut:${id}`, JSON.stringify({
        id,
        code: `CC-${branch.code}-PENDIENTE`,
        status: "ABIERTO",
        branch: { id: branch.id, name: branch.name },
        salesByMethod: [], outflows: [], inflows: [], evidences: [], denominations: [],
        cashCounted: null, cashExpected: null, difference: null, envelopeAmount: null,
        envelopeNumber: null, nextFund: null, event: null,
      }));
      localStorage.setItem(`maestro:open-cash-cut:${branchId}`, id);
      router.push(`/cash-cuts/daily/${id}`);
      return;
    }
    const res = await fetch("/api/cash-cuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "No se pudo abrir el corte");
      return;
    }

    const cashCut = await res.json();
    router.push(`/cash-cuts/daily/${cashCut.id}`);
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold text-on-surface mb-1">Nuevo corte de caja</h1>
      <p className="text-on-surface-variant text-sm mb-6">
        Abre el turno contando el fondo de caja billete por billete.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardLabel>Sucursal</CardLabel>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
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
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </Card>

        {events.length > 0 && (
          <Card>
            <CardLabel>Evento (opcional)</CardLabel>
            <p className="mb-2 text-xs text-on-surface-variant">
              Si este turno es para un evento, elígelo aquí: su inventario
              cargado se descontará automáticamente de esta sucursal.
            </p>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
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

        <Card>
          <CardLabel>Fondo de caja (con el que abres el turno)</CardLabel>
          <DenominationCounter
            onTotalChange={(total, breakdown) => {
              setStartingFund(total > 0 ? String(total) : "");
              setStartingFundBreakdown(breakdown);
            }}
          />
        </Card>

        {error && <p className="text-error text-sm">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Abriendo..." : "Abrir corte"}
        </Button>
      </form>
    </div>
  );
}
