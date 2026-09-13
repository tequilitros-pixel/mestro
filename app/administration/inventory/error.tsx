"use client";

export default function InventoryError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-error/30 bg-surface-container p-6">
        <h1 className="text-2xl font-bold">No se pudo cargar Inventario</h1>
        <p className="mt-3 text-sm text-on-surface-variant">
          Ocurrió un problema al consultar la información. Intenta cargar la pantalla de nuevo.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
