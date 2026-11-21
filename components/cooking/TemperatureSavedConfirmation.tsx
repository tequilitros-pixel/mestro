import Link from "next/link";

export default function TemperatureSavedConfirmation({
  closeHref,
  registerAnotherHref,
}: {
  closeHref: string;
  registerAnotherHref: string;
}) {
  return (
    <div
      aria-labelledby="temperature-saved-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="dialog"
    >
      <section className="w-full max-w-md rounded-3xl border border-tertiary-fixed-dim/40 bg-surface-container p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-tertiary-fixed-dim/20 text-3xl text-tertiary-fixed-dim">
          ✓
        </div>

        <h2
          id="temperature-saved-title"
          className="mt-5 text-2xl font-bold text-on-surface"
        >
          Las temperaturas se han guardado correctamente
        </h2>

        <p className="mt-3 text-sm text-on-surface-variant">
          La lectura quedó registrada en la bitácora de cocción.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href={registerAnotherHref}
            className="rounded-xl bg-primary px-4 py-3 font-bold text-on-primary"
          >
            Registrar otra lectura
          </Link>
          <Link
            href={closeHref}
            className="rounded-xl border border-outline-variant px-4 py-3 font-bold text-on-surface"
          >
            Cerrar
          </Link>
        </div>
      </section>
    </div>
  );
}
