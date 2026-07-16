export default function LiquorsPage() {
  return (
    <section className="rounded-3xl border border-purple-500/20 bg-slate-900 p-8">
      <p className="text-sm font-bold uppercase tracking-[0.35em] text-purple-400">
        Elaboración de Licores
      </p>

      <h1 className="mt-3 text-4xl font-black text-white">
        Centro de Licores
      </h1>

      <p className="mt-4 max-w-2xl text-slate-400">
        Recetas, lotes, producción, embotellado, inventario, QR y caducidad de
        Destiladora del Norte.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-purple-500/30 p-8 text-center">
        <p className="text-xl font-bold text-white">
          Módulo listo para comenzar
        </p>

        <p className="mt-2 text-slate-400">
          Aquí construiremos el segundo pilar de MAESTRO.
        </p>
      </div>
    </section>
  );
}