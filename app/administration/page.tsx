export default function AdministrationPage() {
  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-8">
      <p className="font-mono text-sm font-bold uppercase tracking-[0.35em] text-on-surface-variant">
        Administración
      </p>

      <h1 className="mt-3 text-4xl font-black text-on-surface">
        Centro Administrativo
      </h1>

      <p className="mt-4 max-w-2xl text-on-surface-variant">
        Finanzas, compras, proveedores, personal, reportes y configuración de
        Destiladora del Norte.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-outline-variant p-8 text-center">
        <p className="text-xl font-bold text-on-surface">
          Módulo listo para comenzar
        </p>

        <p className="mt-2 text-on-surface-variant">
          La base de Administración ya forma parte de MAESTRO.
        </p>
      </div>
    </section>
  );
}