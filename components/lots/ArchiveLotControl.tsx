"use client";

import { useState } from "react";

export default function ArchiveLotControl({
  lotCode,
  action,
}: {
  lotCode: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <section className="mt-8 rounded-2xl border border-error/40 bg-error/10 p-6 sm:p-8">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-error">Lote de prueba</p>
      <h2 className="mt-2 text-2xl font-bold text-on-surface">Anular y archivar sin producir</h2>
      <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
        Conserva el expediente y su bitácora, pero no finaliza el lote ni registra litros o movimientos de inventario.
        Los procesos activos se detienen y el equipo se libera. No se puede deshacer desde esta pantalla.
      </p>
      <form action={action} className="mt-5 grid max-w-2xl gap-4">
        <label className="grid gap-2 text-sm font-semibold text-on-surface">
          Motivo de archivo
          <textarea
            name="reason"
            required
            minLength={10}
            rows={3}
            placeholder="Ej. Prueba de proceso sin producción comercial; se iniciará un lote nuevo."
            className="resize-none rounded-xl border border-outline-variant bg-surface-container px-4 py-3 font-normal text-on-surface outline-none focus:border-error"
          />
        </label>
        <label className="flex items-start gap-3 text-sm text-on-surface-variant">
          <input
            name="confirmed"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 accent-error"
          />
          <span>Confirmo que el lote <strong className="text-on-surface">{lotCode}</strong> no tiene producto final real y debe quedar archivado como prueba.</span>
        </label>
        <button
          type="submit"
          disabled={!confirmed}
          className="w-fit rounded-xl bg-error px-5 py-3 font-bold text-on-error transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anular y archivar lote
        </button>
      </form>
    </section>
  );
}
