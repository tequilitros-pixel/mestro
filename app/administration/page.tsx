export default function AdministrationPage() {
  return (
    <section className="rounded-3xl border border-blue-500/20 bg-slate-900 p-8">
      <p className="text-sm font-bold uppercase tracking-[0.35em] text-blue-400">
        Administración
      </p>

      <h1 className="mt-3 text-4xl font-black text-white">
        Centro Administrativo
      </h1>

      <p className="mt-4 max-w-2xl text-slate-400">
        Finanzas, compras, proveedores, personal, reportes y configuración de
        Destiladora del Norte.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-slate-700 p-8 text-center">
        <p className="text-xl font-bold text-white">
          Módulo listo para comenzar
        </p>

        <p className="mt-2 text-slate-400">
          La base de Administración ya forma parte de MAESTRO.
        </p>
      </div>
    </section>
  );
}