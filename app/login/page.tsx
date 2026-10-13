import { loginAction } from "@/app/actions/login";
import AgaveBackdrop from "@/components/ui/AgaveBackdrop";
import { CoffeeIcon, HeartIcon } from "@/components/ui/icons";
import SmsLoginForm from "./SmsLoginForm";
import SessionAlert from "@/app/components/SessionAlert";

const TIME_ZONE = "America/Mexico_City";

export default function LoginPage() {
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

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-start overflow-y-auto px-3 py-4 text-on-surface sm:justify-center sm:px-6 sm:py-8">
      {/* Fondo: campo de agave al atardecer */}
      <div className="absolute inset-0 -z-10 bg-surface">
        <AgaveBackdrop className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-dim/80 via-surface-dim/70 to-surface-dim/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary-container/30 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-[30rem]">
        <SessionAlert />
      </div>

      <section className="relative z-10 w-full max-w-[30rem] overflow-hidden rounded-2xl border border-outline-variant bg-surface-dim/65 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-outline-variant p-5 text-center sm:p-7">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-on-surface-variant sm:text-xs sm:tracking-[0.4em]">
            Sistema Operativo
          </p>

          <h1 className="mt-2 text-2xl font-black text-primary sm:text-3xl">
            Destiladora del Norte
          </h1>

          <div className="mt-4 sm:mt-6">
            <h2 className="text-xl font-bold text-primary sm:text-2xl">
              {greeting}
            </h2>

            <p className="mt-1.5 text-sm capitalize text-on-surface-variant sm:mt-2">
              {currentDate}
            </p>

            <p className="mt-0.5 font-mono text-xs text-on-surface-variant sm:text-sm">
              {currentTime}
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-high/60 p-3 sm:mt-5 sm:p-3.5">
            <p className="text-xs leading-5 text-on-surface sm:text-sm sm:leading-6">
              Gracias por seguir construyendo la historia de
              Destiladora del Norte.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <form action={loginAction} className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-sm font-semibold text-on-surface-variant"
              >
                Número de teléfono o correo
              </label>

              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                placeholder="494 123 4567 o tu@correo.com"
                className="w-full rounded-lg border border-outline-variant bg-surface-dim/60 px-3.5 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-outline-variant bg-surface-container-high/40 p-2.5">
              <input
                name="rememberDevice"
                type="checkbox"
                defaultChecked
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-semibold text-on-surface">Recordar este dispositivo por 30 días</span>
                <span className="mt-0.5 block text-[0.7rem] leading-4 text-on-surface-variant">No tendrás que volver a iniciar sesión mientras no pulses “Cerrar sesión”.</span>
              </span>
            </label>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
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
                className="w-full rounded-lg border border-outline-variant bg-surface-dim/60 px-3.5 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-primary py-2.5 font-bold text-on-primary transition duration-150 ease-out hover:opacity-90 active:scale-[0.98]"
            >
              Ingresar
            </button>
          </form>

          <details className="mt-4 border-t border-outline-variant pt-4">
            <summary className="cursor-pointer text-center text-sm font-semibold text-on-surface-variant hover:text-primary">
              Ingresar con código por SMS
            </summary>
            <div className="mt-4">
              <SmsLoginForm />
            </div>
          </details>

          <div className="mt-5 space-y-3 border-t border-outline-variant pt-4 text-center">
            <p className="flex flex-wrap items-center justify-center gap-x-1 text-xs leading-5 text-outline">
              <span>Hecho con</span>
              <CoffeeIcon className="h-3.5 w-3.5" />
              <span>, código y mucho</span>
              <HeartIcon className="h-3.5 w-3.5" />
              <span>para Destiladora del Norte.</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 text-xs text-outline">
              <a href="/privacy-policy" className="hover:text-primary transition">
                Política de Privacidad
              </a>
              <span>•</span>
              <a href="/terms-of-service" className="hover:text-primary transition">
                Términos de Servicio
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
