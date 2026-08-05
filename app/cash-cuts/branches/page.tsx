"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { PlusIcon } from "@/components/ui/icons";

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
        <h1 className="text-2xl font-bold text-on-surface">Sucursales</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            "Cancelar"
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <PlusIcon className="h-4 w-4" />
              Nueva sucursal
            </span>
          )}
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

      {loading && <p className="text-on-surface-variant">Cargando...</p>}

      <div className="space-y-2">
        {branches.map((b) => (
          <Card key={b.id}>
            <div className="flex items-center justify-between">
              <div>
                <CardLabel>{b.code}</CardLabel>
                <p className="text-on-surface font-bold text-lg">{b.name}</p>
                {b.address && (
                  <p className="text-on-surface-variant text-xs mt-1">{b.address}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    b.active
                      ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
                      : "bg-surface-container-highest text-on-surface-variant"
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

      <p className="text-xs text-on-surface-variant">
        Para editar la dirección o asignar una geozona a una sucursal, ve a
        Horario &gt; Geozona.
      </p>
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
      body: JSON.stringify({
        name,
        code,
        address: address || undefined,
      }),
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
          className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />
      </Card>
      <Card>
        <CardLabel>Código (único, sin espacios)</CardLabel>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ej. JALPA"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />
      </Card>
      <Card>
        <CardLabel>Dirección (opcional)</CardLabel>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </Card>

      {error && <p className="text-error text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Creando..." : "Crear sucursal"}
      </Button>
    </form>
  );
}
