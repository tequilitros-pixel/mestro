"use client";

import { useEffect, useState } from "react";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";

interface Branch {
  id: string;
  name: string;
}

interface Outflow {
  id: string;
  concept: string;
  category: string;
  amount: number;
  occurredAt: string;
  cashCut: { code: string; branch: { name: string } };
}

export default function ExpensesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [outflows, setOutflows] = useState<Outflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then(setBranches);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);

    fetch(`/api/salidas?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setOutflows(data);
        setLoading(false);
      });
  }, [branchId]);

  const total = outflows.reduce((sum, o) => sum + o.amount, 0);

  const byCategory = outflows.reduce<Record<string, number>>((acc, o) => {
    acc[o.category] = (acc[o.category] ?? 0) + o.amount;
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Salidas de caja</h1>

      <select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600 text-sm"
      >
        <option value="">Todas las sucursales</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <Card highlight>
        <CardLabel>Total de salidas</CardLabel>
        <CardValue>${total.toFixed(2)}</CardValue>
      </Card>

      {Object.keys(byCategory).length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(byCategory).map(([cat, amount]) => (
            <Card key={cat}>
              <CardLabel>{cat}</CardLabel>
              <p className="text-white font-bold">${amount.toFixed(2)}</p>
            </Card>
          ))}
        </div>
      )}

      {loading && <p className="text-slate-400">Cargando...</p>}

      {!loading && outflows.length === 0 && (
        <Card>
          <p className="text-slate-400 text-sm">No hay salidas registradas.</p>
        </Card>
      )}

      <div className="space-y-2">
        {outflows.map((o) => (
          <Card key={o.id}>
            <div className="flex justify-between">
              <div>
                <p className="text-white font-semibold">{o.concept}</p>
                <p className="text-slate-400 text-xs mt-1">
                  {o.category} · {o.cashCut.branch.name} · {o.cashCut.code}
                </p>
                <p className="text-slate-500 text-xs">
                  {new Date(o.occurredAt).toLocaleDateString("es-MX")}
                </p>
              </div>
              <p className="text-white font-bold">${o.amount.toFixed(2)}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
