"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  active: boolean;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    fetch("/api/branches?includeInactive=true")
      .then((res) => res.json())
      .then((data) => {
        setBranches(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(branch: Branch) {
    await fetch(`/api/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !branch.active }),
    });
    load();
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Sucursales</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "+ Nueva sucursal"}
        </Button>
      </div>

      {showForm && (
        <NewBranchForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading && <p className="text-slate-400">Cargando...</p>}

      <div className="space-y-2">
        {branches.map((b) => (
          <Card key={b.id}>
            <div className="flex items-center justify-between">
              <div>
                <CardLabel>{b.code}</CardLabel>
                <p className="text-white font-bold text-lg">{b.name}</p>
                {b.address && <p className="text-slate-400 text-xs mt-1">{b.address}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    b.active ? "bg-green-500/20 text-green-300" : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {b.active ? "Activa" : "Inactiva"}
                </span>
                <Button size="sm" variant="secondary" onClick={() => toggleActive(b)}>
                  {b.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewBranchForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name || !code) {
      setError("Nombre y código son obligatorios.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, address: address || undefined }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "No se pudo crear la sucursal");
      return;
    }

    setName("");
    setCode("");
    setAddress("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Card>
        <CardLabel>Nombre</CardLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Jalpa"
          className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
        />
      </Card>
      <Card>
        <CardLabel>Código (único, sin espacios)</CardLabel>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ej. JALPA"
          className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
        />
      </Card>
      <Card>
        <CardLabel>Dirección (opcional)</CardLabel>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
        />
      </Card>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Creando..." : "Crear sucursal"}
      </Button>
    </form>
  );
}
