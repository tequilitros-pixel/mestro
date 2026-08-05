"use client";

import { useEffect, useState, startTransition } from "react";
import Link from "next/link";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";

interface Branch {
  id: string;
  name: string;
}

interface CashCut {
  id: string;
  code: string;
  status: string;
  date: string;
  difference: number | null;
  totalSales: number | null;
  branch: { name: string };
  responsible: { name: string };
}

const STATUS_STYLE: Record<string, string> = {
  ABIERTO: "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim",
  CERRADO: "bg-surface-container-highest text-on-surface-variant",
  AUDITADO: "bg-on-surface-variant/10 text-on-surface-variant",
};

export default function CashCutsHistoryPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [cashCuts, setCashCuts] = useState<CashCut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then(setBranches);
  }, []);

  useEffect(() => {
    startTransition(() => {
      setLoading(true);
    });

    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (status) params.set("status", status);

    fetch(`/api/cash-cuts?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCashCuts(data);
        setLoading(false);
      });
  }, [branchId, status]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-on-surface">Historial de cortes</h1>

      <div className="flex gap-3">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="flex-1 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex-1 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        >
          <option value="">Todos los estados</option>
          <option value="ABIERTO">Abierto</option>
          <option value="CERRADO">Cerrado</option>
          <option value="AUDITADO">Auditado</option>
        </select>
      </div>

      {loading && <p className="text-on-surface-variant">Cargando...</p>}

      {!loading && cashCuts.length === 0 && (
        <Card>
          <p className="text-on-surface-variant text-sm">No se encontraron cortes con esos filtros.</p>
        </Card>
      )}

      <div className="space-y-2">
        {cashCuts.map((cc) => (
          <Link key={cc.id} href={`/cash-cuts/daily/${cc.id}`}>
            <Card className="hover:border-primary/25 transition cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <CardLabel>
                    {cc.branch.name} · {new Date(cc.date).toLocaleDateString("es-MX")}
                  </CardLabel>
                  <CardValue>{cc.code}</CardValue>
                  <p className="text-on-surface-variant text-xs mt-1">
                    Responsable: {cc.responsible.name}
                    {cc.totalSales !== null && ` · Ventas: $${cc.totalSales.toFixed(2)}`}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      STATUS_STYLE[cc.status] ?? "bg-surface-container-highest text-on-surface-variant"
                    }`}
                  >
                    {cc.status}
                  </span>
                  {cc.difference !== null && (
                    <p
                      className={`text-xs mt-1 font-semibold ${
                        cc.difference === 0
                          ? "text-on-surface-variant"
                          : cc.difference > 0
                          ? "text-tertiary-fixed-dim"
                          : "text-error"
                      }`}
                    >
                      {cc.difference > 0 ? "+" : ""}
                      ${cc.difference.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
