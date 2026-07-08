export default function DistillationHeader() {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-700 p-6">
      <div className="flex justify-between items-center">

        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400">
            DESTILACIÓN
          </p>

          <h1 className="text-3xl font-bold text-white mt-2">
            Centro de Control
          </h1>

          <p className="text-slate-400 mt-2">
            Monitoreo en tiempo real del proceso.
          </p>

        </div>

        <div className="rounded-full bg-green-500/20 px-5 py-2">
          <span className="text-green-400 font-semibold">
            ● Planta Operando
          </span>
        </div>

      </div>
    </div>
  )
}