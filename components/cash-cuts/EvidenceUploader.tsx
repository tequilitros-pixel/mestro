"use client";

import { useEffect, useState, startTransition } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type EvidenceType = "DINERO_CONTADO" | "SOBRE" | "TICKET" | "NOTA" | "FACTURA" | "OTRO";

interface Evidence {
  id: string;
  type: EvidenceType;
  url: string;
  notes: string | null;
  createdAt: string;
}

const TIPOS: { key: EvidenceType; label: string }[] = [
  { key: "DINERO_CONTADO", label: "Dinero contado" },
  { key: "SOBRE", label: "Sobre" },
  { key: "TICKET", label: "Ticket" },
  { key: "NOTA", label: "Nota" },
  { key: "FACTURA", label: "Factura" },
  { key: "OTRO", label: "Otro" },
];

const TYPE_LABELS: Record<EvidenceType, string> = Object.fromEntries(
  TIPOS.map((t) => [t.key, t.label])
) as Record<EvidenceType, string>;

interface EvidenceUploaderProps {
  cashCutId: string;
  disabled: boolean;
}

export function EvidenceUploader({ cashCutId, disabled }: EvidenceUploaderProps) {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<EvidenceType>("DINERO_CONTADO");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEvidences() {
  try {
    const res = await fetch(`/api/cash-cuts/${cashCutId}/evidencias`);
    if (!res.ok) throw new Error("No se pudieron cargar las evidencias");
    const data: Evidence[] = await res.json();
    startTransition(() => {
      setEvidences(data);
      setLoading(false);
    });
  } catch {
    startTransition(() => {
      setEvidences([]);
      setLoading(false);
    });
  }
}


  useEffect(() => {
    loadEvidences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashCutId]);

  async function handleUpload() {
    if (!file) {
      setError("Selecciona una foto primero.");
      return;
    }
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    if (notes) formData.append("notes", notes);

    try {
      const res = await fetch(`/api/cash-cuts/${cashCutId}/evidencias`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("No se pudo subir la evidencia");
      setFile(null);
      setNotes("");
      await loadEvidences();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardLabel>Evidencias fotográficas</CardLabel>

      {!disabled && (
        <div className="space-y-3 mt-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EvidenceType)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
          >
            {TIPOS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-slate-300"
          />

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nota (opcional)"
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
          />

          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? "Subiendo..." : "Subir evidencia"}
          </Button>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        {loading && <p className="text-slate-400 text-sm col-span-full">Cargando...</p>}

        {!loading && evidences.length === 0 && (
          <p className="text-slate-400 text-sm col-span-full">Sin evidencias registradas.</p>
        )}

        {!loading &&
          evidences.map((ev) => (
            <a
              key={ev.id}
              href={ev.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={ev.url}
                alt={TYPE_LABELS[ev.type]}
                className="w-full h-24 object-cover rounded-lg border border-slate-600"
              />
              <p className="text-xs text-slate-400 mt-1">{TYPE_LABELS[ev.type]}</p>
            </a>
          ))}
      </div>
    </Card>
  );
}
