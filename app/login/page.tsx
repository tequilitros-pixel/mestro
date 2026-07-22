import Image from "next/image";
import { loginAction } from "@/app/actions/login";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-white sm:px-6">
      {/* Fondo: campo de agave / destiladora */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/agave-field.jpg"
          alt="Campo de agave, Destiladora del Norte"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/70 to-slate-950/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-amber-950/30 via-transparent to-transparent" />
      </div>

      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950/50 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/10 p-6 text-center sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-400">
            MAESTRO
          </p>

          <h1 className="mt-4 text-3xl font-black text-white">
            Sistema Inteligente
          </h1>

          <p className="mt-2 text-sm font-medium text-blue-300">
            Destiladora del Norte
          </p>

          <div className="mt-8">
            <h2 className="text-2xl font-bold sm:text-3xl">
              {greeting}
            </h2>

            <p className="mt-3 capitalize text-slate-300">
              {currentDate}
            </p>

            <p className="mt-1 text-sm text-amber-400">
              {currentTime}
            </p>
          </div>

          <div className="mt-7 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="text-sm leading-6 text-slate-200">
              Gracias por seguir construyendo la historia de
              Destiladora del Norte.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {hasError && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              Correo o contraseña incorrectos.
            </div>
          )}

          {justReset && (
            <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              Contraseña actualizada. Ya puedes iniciar sesión.
            </div>
          )}

          <form action={loginAction} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-300"
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
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-300"
                >
                  Contraseña
                </label>

                <a
                  href="/forgot-password"
                  className="text-xs font-medium text-amber-400 transition hover:text-amber-300"
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
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-400 py-3 font-bold text-slate-950 transition hover:bg-amber-300"
            >
              Ingresar
            </button>
          </form>

          <div className="mt-8 border-t border-white/10 pt-6 text-center">
            <p className="text-xs leading-5 text-slate-500">
              Hecho con ☕, código y mucho ❤️ para
              Destiladora del Norte.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
