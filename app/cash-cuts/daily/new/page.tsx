"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function NuevoCortePage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startingFund, setStartingFund] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => {
        setBranches(data);
        if (data.length === 1) setBranchId(data[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!branchId || startingFund === "") {
      setError("Selecciona la sucursal y captura el fondo de caja.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/cash-cuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        date,
        startingFund: Number(startingFund),
      }),
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
      <h1 className="text-2xl font-bold text-white mb-1">Nuevo corte de caja</h1>
      <p className="text-slate-400 text-sm mb-6">Paso 1 de 5 — Abrir corte</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardLabel>Sucursal</CardLabel>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
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
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
          />
        </Card>

        <Card>
          <CardLabel>Fondo de caja (con el que abres el turno)</CardLabel>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Ej. 1000"
            value={startingFund}
            onChange={(e) => setStartingFund(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
          />
        </Card>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Abriendo..." : "Abrir corte"}
        </Button>
      </form>
    </div>
  );
}
