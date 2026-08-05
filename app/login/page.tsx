import { loginAction } from "@/app/actions/login";
import AgaveBackdrop from "@/components/ui/AgaveBackdrop";
import { CoffeeIcon, HeartIcon } from "@/components/ui/icons";

const TIME_ZONE = "America/Mexico_City";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    reset?: string;
  }>;
}) {
  const params = await searchParams;
  const now = new Date();


  const hour = Number(
    new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      hour12: false,
      timeZone: TIME_ZONE,
    }).format(now)
  );

  const greeting =
    hour >= 6 && hour < 12
      ? "Buenos días"
      : hour >= 12 && hour < 19
        ? "Buenas tardes"
        : "Buenas noches";

  const currentDate = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(now);

  const currentTime = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(now);

  const hasError = params?.error === "1";
  const justReset = params?.reset === "1";


  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-on-surface sm:px-6">
      {/* Fondo: campo de agave al atardecer */}
      <div className="absolute inset-0 -z-10 bg-surface">
        <AgaveBackdrop className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-dim/80 via-surface-dim/70 to-surface-dim/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary-container/30 via-transparent to-transparent" />
      </div>

      <section className="w-full max-w-md overflow-hidden rounded-xl border border-outline-variant bg-surface-dim/50 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-outline-variant p-6 text-center sm:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.45em] text-on-surface-variant">
            Sistema Operativo
          </p>

          <h1 className="mt-4 text-3xl font-black text-primary">
            Destiladora del Norte
          </h1>

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-primary sm:text-3xl">
              {greeting}
            </h2>

            <p className="mt-3 capitalize text-on-surface-variant">
              {currentDate}
            </p>

            <p className="mt-1 font-mono text-sm text-on-surface-variant">
              {currentTime}
            </p>
          </div>

          <div className="mt-7 rounded-xl border border-outline-variant bg-surface-container-high/60 p-4">
            <p className="text-sm leading-6 text-on-surface">
              Gracias por seguir construyendo la historia de
              Destiladora del Norte.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {hasError && (
            <div className="mb-5 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
              Correo o contraseña incorrectos.
            </div>
          )}

          {justReset && (
            <div className="mb-5 rounded-xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 p-3 text-sm text-tertiary-fixed-dim">
              Contraseña actualizada. Ya puedes iniciar sesión.
            </div>
          )}

          <form action={loginAction} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-on-surface-variant"
              >
                Correo electrónico
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@correo.com"
                className="w-full rounded-xl border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-on-surface-variant"
                >
                  Contraseña
                </label>

                <a
                  href="/forgot-password"
                  className="text-xs font-medium text-on-surface-variant transition hover:text-primary"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
            >
              Ingresar
            </button>
          </form>

          <div className="mt-8 border-t border-outline-variant pt-6 text-center">
            <p className="flex flex-wrap items-center justify-center gap-x-1 text-xs leading-5 text-outline">
              <span>Hecho con</span>
              <CoffeeIcon className="h-3.5 w-3.5" />
              <span>, código y mucho</span>
              <HeartIcon className="h-3.5 w-3.5" />
              <span>para Destiladora del Norte.</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
