import type { Metadata } from "next";
import Link from "next/link";

const canonicalUrl = "https://www.destiladoradelnorte.com/TequilaElColotlense";
const whatsappUrl =
  "https://wa.me/525662989202?text=" +
  encodeURIComponent("Hola, quiero información sobre Tequila El Colotlense.");

export const metadata: Metadata = {
  title: "Tequila El Colotlense | Casa Destiladora del Norte",
  description:
    "Conoce Tequila El Colotlense, orgullosamente de Colotlán, Jalisco. Descubre nuestras expresiones y contacta a Casa Destiladora del Norte.",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    type: "website",
    locale: "es_MX",
    title: "Tequila El Colotlense | Colotlán, Jalisco",
    description: "Tequila con identidad colotlense, de Casa Destiladora del Norte.",
    url: canonicalUrl,
    siteName: "Casa Destiladora del Norte",
  },
  robots: { index: true, follow: true },
};

const expresiones = [
  {
    nombre: "Blanco",
    subtitulo: "La esencia del agave",
    descripcion:
      "Una expresión fresca y directa, ideal para descubrir el carácter del tequila y disfrutar en coctelería.",
    numero: "01",
  },
  {
    nombre: "Reposado",
    subtitulo: "Equilibrio y tradición",
    descripcion:
      "Una alternativa de carácter más redondo para quienes prefieren disfrutar su tequila con calma.",
    numero: "02",
  },
  {
    nombre: "Añejo",
    subtitulo: "Una experiencia pausada",
    descripcion:
      "Una expresión para apreciar con tranquilidad y descubrir matices que invitan a una degustación especial.",
    numero: "03",
  },
] as const;

export default function TequilaElColotlensePage() {
  return (
    <main className="min-h-screen bg-[#111410] text-[#f5f0e6]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[690px] opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 75% 18%, rgba(192,151,77,0.19), transparent 55%), radial-gradient(ellipse at 10% 90%, rgba(89,111,66,0.18), transparent 55%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[#b7a989]/25 py-7">
          <Link href="/TequilaElColotlense" className="text-xs font-semibold uppercase tracking-[0.24em] text-[#e4d4ab] sm:text-sm">
            Casa Destiladora del Norte
          </Link>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#cba66f]/65 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#f8edd2] transition hover:bg-[#cba66f] hover:text-[#171b14]">
            Solicitar información
          </a>
        </header>

        <section className="grid min-h-[610px] items-center gap-14 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:py-28">
          <div className="max-w-3xl">
            <p className="mb-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#cba66f]">
              <span className="h-px w-10 bg-[#cba66f]" aria-hidden="true" />
              Colotlán · Jalisco · México
            </p>
            <h1 className="font-serif text-6xl leading-[0.98] tracking-tight text-[#f7efdd] sm:text-7xl lg:text-[6.5rem]">
              Tequila
              <span className="mt-3 block italic text-[#d8b980]">El Colotlense</span>
            </h1>
            <p className="mt-9 max-w-xl text-lg leading-relaxed text-[#c9c7bd]">
              Nacido del orgullo por nuestra tierra. Una invitación a conocer la
              tradición tequilera de Colotlán y compartir su carácter en cada copa.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a href="#expresiones" className="rounded-full bg-[#d5b37e] px-7 py-3.5 text-sm font-bold text-[#171b14] transition hover:bg-[#efc994]">
                Conoce nuestros tequilas
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#e7dac0]/40 px-7 py-3.5 text-sm font-semibold text-[#efe8da] transition hover:border-[#d5b37e]">
                Contactar a la destiladora
              </a>
            </div>
          </div>

          <div className="relative mx-auto flex aspect-[4/5] w-full max-w-sm items-center justify-center overflow-hidden rounded-t-full border border-[#b9975a]/35 bg-gradient-to-b from-[#394332] via-[#252b23] to-[#141713] p-10 shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
            <div className="absolute inset-5 rounded-t-full border border-[#c8b17f]/20" aria-hidden="true" />
            <div className="relative text-center">
              <p className="text-[10px] uppercase tracking-[0.55em] text-[#d9c49c]">Origen</p>
              <div className="mx-auto my-10 h-40 w-px bg-gradient-to-b from-transparent via-[#ceb481] to-transparent" aria-hidden="true" />
              <p className="font-serif text-5xl italic leading-none text-[#e7d4aa]">Colotlán</p>
              <p className="mt-4 text-xs uppercase tracking-[0.4em] text-[#bdbca7]">Jalisco, México</p>
            </div>
          </div>
        </section>
      </div>

      <section id="expresiones" className="border-t border-[#b7a989]/20 bg-[#191e18] py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#cba66f]">Nuestra selección</p>
          <h2 className="mt-4 font-serif text-4xl text-[#f7efdd] sm:text-5xl">Tres maneras de descubrirlo</h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-[#bbbdb3]">
            Descubre nuestras expresiones de tequila y elige la que mejor acompañe tu ocasión.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {expresiones.map((item) => (
              <article key={item.nombre} className="flex min-h-72 flex-col rounded-2xl border border-[#cab68b]/20 bg-[#222920] p-8">
                <span className="text-xs font-semibold tracking-[0.25em] text-[#cba66f]">{item.numero}</span>
                <h3 className="mt-9 font-serif text-4xl text-[#f2e8d5]">{item.nombre}</h3>
                <p className="mt-2 text-sm font-medium text-[#d4b986]">{item.subtitulo}</p>
                <p className="mt-5 text-sm leading-7 text-[#c3c4bb]">{item.descripcion}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24 text-center sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#cba66f]">De Colotlán para compartir</p>
        <h2 className="mx-auto mt-5 max-w-2xl font-serif text-4xl leading-tight text-[#f7efdd] sm:text-5xl">
          Conoce más de Tequila El Colotlense
        </h2>
        <p className="mx-auto mt-6 max-w-xl leading-relaxed text-[#c9c7bd]">
          Pregunta por nuestras presentaciones, disponibilidad y opciones para tu evento.
        </p>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-9 inline-block rounded-full bg-[#d5b37e] px-8 py-4 text-sm font-bold text-[#171b14] transition hover:bg-[#efc994]">
          Hablar por WhatsApp
        </a>
      </section>

      <footer className="border-t border-[#b7a989]/20 px-6 py-9 text-center text-xs leading-6 text-[#a8a99f] sm:px-10">
        <p>Tequila El Colotlense · Casa Destiladora del Norte · Colotlán, Jalisco</p>
        <p>Producto para mayores de edad. Disfruta con moderación.</p>
        <Link href="/tequilitros" className="mt-2 inline-block text-[#d4b986] underline underline-offset-4">
          Conoce nuestras barras para eventos
        </Link>
      </footer>
    </main>
  );
}
