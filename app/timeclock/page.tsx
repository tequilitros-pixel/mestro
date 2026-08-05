import ClockWidget from "./ClockWidget";

export default function TimeClockPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Checador</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Registra tu entrada y salida.
          </p>
        </div>

        <ClockWidget />
      </div>
    </main>
  );
}
