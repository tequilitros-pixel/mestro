export default function InventoryLoading() {
  return (
    <main
      className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-3">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
            Administración
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">Inventario</h1>
          <p className="text-sm text-on-surface-variant">Cargando inventario…</p>
        </div>
        <div className="h-32 animate-pulse rounded-2xl border border-outline-variant bg-surface-container" />
      </div>
    </main>
  );
}
