export function TopBar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-8">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Sistema MAESTRO
        </h2>

        <p className="text-sm text-slate-400">
          Destiladora del Norte
        </p>
      </div>

      <div className="flex items-center gap-4">
        <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-400">
          Planta Operando
        </span>

        <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center font-bold text-slate-900">
          JS
        </div>
      </div>
    </header>
  );
}