"use client";

import { useEffect, useState, startTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Branch {
  id: string;
  name: string;
}

interface EnvelopeRow {
  id: string;
  branch: string;
  date: string;
  envelopeAmount: number;
  envelopeNumber: string | null;
  envelopeNotes: string | null;
  responsible: string | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );

export default function EnvelopesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<EnvelopeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => setBranches(data))
      .catch(() => setBranches([]));
  }, []);

 const fetchEnvelopes = async () => {
  startTransition(() => {
    setLoading(true);
    setError(null);
  });

  try {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const res = await fetch(`/api/cash-cuts/envelopes?${params.toString()}`);
    if (!res.ok) throw new Error("No se pudieron cargar los sobres");
    const data = await res.json();
    setRows(data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Error desconocido");
    setRows([]);
  } finally {
    setLoading(false);
  }
};

  const total = rows.reduce((sum, r) => sum + r.envelopeAmount, 0);

  const byBranch = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.branch] = (acc[r.branch] || 0) + r.envelopeAmount;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Sobres</h1>
        <p className="text-sm text-gray-500">
          Consulta del dinero enviado a sobre en cada corte cerrado, por sucursal y fecha.
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

          <Button onClick={fetchEnvelopes}>Filtrar</Button>
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
                <th className="px-4 py-3">Sucursal</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3"># Sobre</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    No hay sobres registrados para este filtro.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.branch}</td>
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">{r.envelopeNumber || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      {formatCurrency(r.envelopeAmount)}
                    </td>
                    <td className="px-4 py-3">{r.responsible || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{r.envelopeNotes || "—"}</td>
                  </tr>
                ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 font-semibold bg-gray-50">
                  <td className="px-4 py-3" colSpan={3}>
                    Total ({rows.length} {rows.length === 1 ? "sobre" : "sobres"})
                  </td>
                  <td className="px-4 py-3 text-right text-green-800">{formatCurrency(total)}</td>
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {Object.keys(byBranch).length > 1 && (
        <Card>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Subtotal por sucursal</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(byBranch).map(([branch, amount]) => (
                <div key={branch} className="border rounded-md px-3 py-2">
                  <div className="text-xs text-gray-500">{branch}</div>
                  <div className="font-semibold">{formatCurrency(amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
