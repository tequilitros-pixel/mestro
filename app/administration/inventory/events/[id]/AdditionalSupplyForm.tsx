"use client";

import { useState, type FormEvent } from "react";
import { addEventSupplyAction } from "../additionalActions";

export default function AdditionalSupplyForm({
  eventId,
  operationId: initialOperationId,
  products,
  branches,
}: {
  eventId: string;
  operationId: string;
  products: Array<{ id: string; name: string; unit: string }>;
  branches: Array<{ id: string; name: string }>;
}) {
  const [operationId, setOperationId] = useState(initialOperationId);
  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const unit = products.find((product) => product.id === productId)?.unit ?? "unidades";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await addEventSupplyAction({
        eventId, productId, sourceBranchId: branchId, quantity, notes, operationId,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOperationId(result.nextOperationId);
      setQuantity("");
      setNotes("");
      setMessage("Carga adicional registrada; aparecerá en la lista del evento.");
    } catch {
      setError("No se pudo confirmar el registro. Reintenta sin cambiar los datos para evitar duplicarlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <h3 className="text-lg font-semibold text-on-surface">Cargar más durante el evento</h3>
      <p className="mt-1 text-sm text-on-surface-variant">
        Registra una nueva salida sin cambiar la lista inicial. Puede ser un producto ya incluido o uno nuevo.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-on-surface-variant">
          Producto
          <select required value={productId} onChange={(event) => setProductId(event.target.value)} disabled={saving} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2 text-on-surface">
            <option value="">Selecciona un producto</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-on-surface-variant">
          Sucursal de origen
          <select required value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={saving} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2 text-on-surface">
            <option value="">Selecciona una sucursal</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-on-surface-variant">
          Cantidad adicional ({unit})
          <input required type="number" inputMode="decimal" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={saving} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2 text-on-surface" />
        </label>
        <label className="text-sm text-on-surface-variant">
          Motivo o referencia
          <input value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} maxLength={500} placeholder="Ej. faltó agua mineral" className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2 text-on-surface" />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving || !products.length || !branches.length} className="rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-50">
            {saving ? "Registrando…" : "Registrar carga adicional"}
          </button>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          {message && <p role="status" className="text-sm text-tertiary-fixed-dim">{message}</p>}
        </div>
      </form>
    </section>
  );
}
