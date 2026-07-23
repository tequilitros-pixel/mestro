"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";

interface CashCut {
  id: string;
  code: string;
  status: string;
  date: string;
  branch: { name: string };
  responsible: { name: string };
}

export default function CashCutsHomePage() {
  const [cashCuts, setCashCuts] = useState<CashCut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cash-cuts?status=ABIERTO")
      .then((res) => res.json())
      .then((data) => {
        setCashCuts(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Cortes de Caja</h1>
        <Link href="/cash-cuts/daily/new">
          <Button>+ Nuevo corte</Button>
        </Link>
      </div>

      <div>
        <h2 className="text-slate-400 text-sm font-semibold uppercase mb-3">
          Cortes abiertos
        </h2>

        {loading && <p className="text-slate-400">Cargando...</p>}

        {!loading && cashCuts.length === 0 && (
          <Card>
            <p className="text-slate-400 text-sm">
              No hay cortes abiertos en este momento.
            </p>
          </Card>
        )}

        <div className="space-y-2">
          {cashCuts.map((cc) => (
            <Link key={cc.id} href={`/cash-cuts/daily/${cc.id}`}>
              <Card className="hover:border-yellow-400/50 transition cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <CardLabel>{cc.branch.name}</CardLabel>
                    <CardValue>{cc.code}</CardValue>
                    <p className="text-slate-400 text-xs mt-1">
                      Responsable: {cc.responsible.name}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-300">
                    {cc.status}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Link href="/cash-cuts/history" className="block text-center text-slate-400 text-sm hover:text-white">
        Ver historial completo →
      </Link>
    </div>
  );
}
