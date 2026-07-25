"use client";

import { useEffect, useState, startTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Branch {
  id: string;
  name: string;
}

interface AuditEntry {
  id: string;
  cashCutCode: string;
  branch: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  user: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Creación",
  UPDATE: "Edición",
  CLOSE: "Cierre",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function AuditPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then((data: Branch[]) => setBranches(data))
      .catch(() => setBranches([]));
  }, []);

  const fetchAudit = async () => {
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/cash-cuts/audit?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo cargar la auditoría");
      const data: AuditEntry[] = await res.json();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Auditoría</h1>
        <p className="text-sm text-gray-500">
          Historial de creación, ediciones y cierres de cortes de caja: quién hizo qué y cuándo.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Sucursal</label>
            <select
              className="border rounded-md px-3 py-2 text-sm min-w-[180px]"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Desde</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Hasta</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <Button onClick={fetchAudit}>Filtrar</Button>
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-md p-3 border border-red-200">
          {error}
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-900 text-white text-left">
                <th className="px-4 py-3">Fecha/Hora</th>
                <th className="px-4 py-3">Corte</th>
                <th className="px-4 py-3">Sucursal</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Campo</th>
                <th className="px-4 py-3">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    No hay movimientos registrados para este filtro.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{r.cashCutCode}</td>
                    <td className="px-4 py-3">{r.branch}</td>
                    <td className="px-4 py-3">{r.user}</td>
                    <td className="px-4 py-3">{ACTION_LABELS[r.action] ?? r.action}</td>
                    <td className="px-4 py-3 text-gray-500">{r.field || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.oldValue || r.newValue ? (
                        <span>
                          {r.oldValue ?? "—"} → {r.newValue ?? "—"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

