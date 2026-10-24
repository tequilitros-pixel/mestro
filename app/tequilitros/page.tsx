"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./tequilitros.module.css";
import Navbar from "./components/Navbar";
import PricingCalculator from "./components/PricingCalculator";
import CocktailCatalog from "./components/CocktailCatalog";
import TequilitrosCup3D from "./components/TequilitrosCup3D";
import BookingSteps from "./components/BookingSteps";
import VideoPlayer from "./components/VideoPlayer";
import EventQuote from "./EventQuote";
import FloatingWhatsApp from "./components/FloatingWhatsApp";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maestro-destiladora.space";
const whatsappUrl =
  "https://wa.me/525662989202?text=" +
  encodeURIComponent("Hola, quiero cotizar la barra de Tequilitros para mi evento.");

const facebookUrl = "https://www.facebook.com/profile.php?id=1348925031634852";
const instagramUrl = "https://www.instagram.com/tequilitros_eventos/";

const serviceAreas = [
  "Colotlán, Santa María de los Ángeles, Huejúcar, Totatiche, Villa Guerrero, Mezquitic (Norte de Jalisco)",
  "Tlaltenango, Jerez, Fresnillo, Zacatecas Capital, Tepechitlán, Momax (Zacatecas)",
  "Calvillo, Aguascalientes y municipios colindantes",
  "Guadalajara, Zapopan y Zona Metropolitana de Jalisco (sujeto a logística y viáticos)",
];

const faqList = [
  {
    q: "¿Cuál es la diferencia entre Barra Libre y Barra a Consumo?",
    a: "En Barra Libre pagas una tarifa fija de $90 MXN por persona por un servicio de 4 horas; tus invitados toman cócteles sin límite y tu costo es 100% predecible (ideal para bodas y XV años). En Barra a Consumo pagas $250 MXN por cada hora de atención en barra más únicamente los productos que realmente se consuman al final tras el conteo (ideal para eventos donde el consumo es moderado).",
  },
  {
    q: "¿Qué incluye el servicio y qué no incluye?",
    a: "INCLUYE: Personal de preparación (bartenders profesionales), bebidas y tequila de la casa, mezcladores, hielo ilimitado, vasos de 32 oz e insumos completos (fruta fresca, sal, salsas y chile). NO INCLUYE: Meseros, servicio en mesas ni distribución entre los invitados (los invitados acuden directamente a la barra móvil a solicitar sus bebidas).",
  },
  {
    q: "¿Cómo funciona la Degustación Gratuita?",
    a: "Para que pruebes la calidad de nuestro tequila y los cócteles antes de tu evento, ofrecemos Degustación Gratuita en nuestra sucursal disponible más cercana en Colotlán y la región. Puedes solicitarla directamente al cotizar tu fecha por WhatsApp.",
  },
  {
    q: "¿A partir de cuántos invitados atienden eventos?",
    a: "Atendemos eventos desde 40 personas en adelante, adaptándonos al tamaño de tu fiesta, jardín o salón.",
  },
  {
    q: "¿Cómo se calculan y pagan los viáticos fuera de Colotlán?",
    a: "Nuestra base es Colotlán, Jalisco. Para traslados cercanos (Tlaltenango, Jerez, etc.) el costo típico es de aproximadamente $500 MXN; para Zacatecas Capital o Fresnillo es de $800 MXN; y para Guadalajara $1,200 MXN. Todo se desglosa por escrito en tu cotización antes de pagar.",
  },
  {
    q: "¿Cómo es el proceso de pago y reservación?",
    a: "Para apartar y congelar la fecha de tu evento se requiere un anticipo del 50%. En Barra Libre, el 50% restante se liquida antes de iniciar el servicio. En Barra a Consumo, la atención se liquida antes y el consumo final se paga al concluir el conteo.",
  },
  {
    q: "¿Qué necesita tener el salón o jardín para instalar la barra móvil?",
    a: "Solo un espacio accesible, seguro y nivelado para instalar el módulo de barra de madera, con una toma de energía eléctrica y acceso a agua corriente cuando sea necesario. Nosotros nos encargamos de todo el montaje 1.5 a 2 horas antes de que comience tu evento.",
  },
  {
    q: "¿Ofrecen opciones de cócteles sin alcohol para niños o personas que no beben?",
    a: "Sí, preparamos versiones sin alcohol (mocktails) con fruta fresca del día, cítricos recién exprimidos, refresco de toronja y escarchados artesanales para que todos disfruten de la barra móvil.",
  },
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/tequilitros#organization`,
        name: "Tequilitros Eventos",
        alternateName: ["Destiladora del Norte", "Tequilitros Barra Móvil"],
        url: `${siteUrl}/tequilitros`,
        logo: `${siteUrl}/icon-192.png`,
        image: `${siteUrl}/tequilitros/productos/cantarito.png`,
        email: "tequilitros@gmail.com",
        telephone: "+52 56 6298 9202",
        areaServed: [
          "Colotlán",
          "Jalisco",
          "Zacatecas",
          "Guadalajara",
          "Zapopan",
          "Jerez",
          "Tlaltenango",
          "Fresnillo",
        ],
        sameAs: [whatsappUrl, facebookUrl, instagramUrl],
      },
      {
        "@type": ["LocalBusiness", "FoodEstablishment", "Service"],
        "@id": `${siteUrl}/tequilitros#business`,
        name: "Tequilitros Eventos - Barra Móvil y Bartender para Eventos",
        description:
          "Barra de tequila para eventos: Barra Libre ($90 MXN/persona) y Barra a Consumo ($250/hr + producto). Cantaritos, palomas, vampiros y mixología desde Colotlán, Jalisco.",
        url: `${siteUrl}/tequilitros`,
        telephone: "+52 56 6298 9202",
        email: "tequilitros@gmail.com",
        priceRange: "$90 MXN por persona",
        image: `${siteUrl}/tequilitros/productos/cantarito.png`,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Carretera Federal 23 #6 Canoas De Arriba",
          addressLocality: "Colotlán",
          addressRegion: "Jalisco",
          postalCode: "46200",
          addressCountry: "MX",
        },
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Modalidades de Barra de Tequila para Eventos",
          itemListElement: [
            {
              "@type": "Offer",
              price: "90",
              priceCurrency: "MXN",
              itemOffered: {
                "@type": "Service",
                name: "Barra Libre para Eventos (4 horas)",
                description:
                  "$90 MXN por persona · servicio de 4 horas sin límite de cócteles.",
              },
            },
            {
              "@type": "Offer",
              price: "250",
              priceCurrency: "MXN",
              itemOffered: {
                "@type": "Service",
                name: "Barra a Consumo",
                description:
                  "$250 MXN por hora de atención + producto consumido contado al final.",
              },
            },
          ],
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqList.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };
}

export default function TequilitrosPage() {
  const [selectedDrinkId, setSelectedDrinkId] = useState("cantarito");

  return (
    <div className={styles.site}>
      {/* Datos Estructurados JSON-LD para Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd()).replace(/</g, "\\u003c"),
        }}
      />

      {/* Navegación Flotante de Cristal con Drawer Móvil */}
      <Navbar />

      <main>
        {/* ================================================================
            1. HERO CINEMATOGRÁFICO & GANCHO PRINCIPAL (EMBUDO)
            ================================================================ */}
        <section className={styles.hero} id="inicio" aria-labelledby="hero-heading">
          <div className={styles.heroBackground}>
            <Image
              src="/tequilitros/cantarito.jpg"
              alt="Barra Móvil Tequilitros Eventos - Barra de tequila en fiesta"
              fill
              priority
              loading="eager"
              sizes="100vw"
              className={styles.heroBackgroundImage}
            />
            <div className={styles.heroBackdropGradient} />
          </div>

          <div className={styles.heroContent}>
            <div className={styles.kickerBadge}>
              <span className={styles.kickerBadgeDot} />
              <span>TEQUILITROS · BARRA MÓVIL PARA EVENTOS</span>
            </div>

            <h1 id="hero-heading" className={styles.heroTitle}>
              Barra de Tequila para los <em>Eventos de tus Clientes.</em>
            </h1>

            <p className={styles.heroLead}>
              Nosotros preparamos las bebidas en barra con bartenders profesionales; tú disfrutas
              tu fiesta o tu salón ofrece el paquete completo. Dos modalidades con precios 100% claros.
            </p>

            {/* Badges de Garantía Rápida */}
            <div className="mb-8 flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E28735]/40 bg-[#E28735]/15 px-3.5 py-1.5 font-mono text-xs font-bold text-[#E28735]">
                <span>●</span> Atendemos desde 40 personas
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3.5 py-1.5 font-mono text-xs font-bold text-[#F5F2EB]">
                <span>●</span> Barra Libre desde $90 MXN / persona
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 font-mono text-xs font-bold text-[#9AA5AC]">
                <span>●</span> Degustación Gratuita previa
              </span>
            </div>

            {/* Llamados a la Acción Inmediatos */}
            <div className={styles.heroActions}>
              <a href="#simulador" className={styles.btnPrimary}>
                <span>Calcular mi Presupuesto en Vivo ↓</span>
                <span aria-hidden="true">⚡</span>
              </a>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnSecondary}
              >
                <span>Cotizar por WhatsApp (56 6298 9202) ↗</span>
              </a>
            </div>

            {/* Métricas de Confianza */}
            <div className={styles.heroBadges}>
              <span>
                <strong>🍸 Bartenders</strong> Dedicados
              </span>
              <span>
                <strong>🪵 Barra de Madera</strong> Incluida
              </span>
              <span>
                <strong>🏆 Vaso 32 oz</strong> (946 ml)
              </span>
              <span>
                <strong>📍 Jalisco</strong> & Zacatecas
              </span>
            </div>
          </div>
        </section>

        {/* ================================================================
            CINTILLO DE IDENTIDAD Y VALORES (TICKER)
            ================================================================ */}
        <div className={styles.tickerRibbon} aria-hidden="true">
          <span>BARRA LIBRE $90 MXN / PERSONA</span>
          <b>✳</b>
          <span>BARRA A CONSUMO $250 / HORA</span>
          <b>✳</b>
          <span>7 PREPARACIONES CON TEQUILA</span>
          <b>✳</b>
          <span>DESDE 40 PERSONAS</span>
          <b>✳</b>
          <span>DEGUSTACIÓN GRATUITA</span>
          <b>✳</b>
          <span>BODAS · XV AÑOS · GRADUACIONES</span>
          <b>✳</b>
          <span>COLOTLÁN · JALISCO · ZACATECAS</span>
        </div>

        {/* ================================================================
            2. LAS DOS MODALIDADES DE PRECIO (PÁGINA 1 DEL PDF)
            ================================================================ */}
        <section className={styles.section} id="modalidades" aria-labelledby="pricing-modalities-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>01 / MODALIDADES DE PRECIO</p>
            <h2 id="pricing-modalities-title" className={styles.sectionTitle}>
              Dos Modalidades con <em>Precios Claros.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Tú eliges cómo pagar: un costo fijo predecible por persona o pagar únicamente lo que tus
              invitados consuman. En ambas modalidades nos encargamos de todo el servicio.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Tarjeta 1: Barra Libre */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-[#E28735] bg-gradient-to-b from-[#181F27] to-[#0E1318] p-6 sm:p-8 shadow-2xl shadow-[#E28735]/10">
              <div className="absolute right-4 top-4 rounded-full bg-[#E28735] px-3 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wider text-[#080B0E]">
                MÁS POPULAR
              </div>

              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E28735]">
                  Modalidad 01
                </span>
                <h3 className="mt-1 font-serif text-3xl font-bold text-[#F5F2EB]">
                  Barra Libre
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-serif text-5xl font-extrabold text-[#E28735]">$90</span>
                  <span className="font-mono text-sm font-semibold text-[#9AA5AC]">
                    MXN por persona · servicio de 4 horas
                  </span>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[#D2DAE0] sm:text-sm">
                  Los invitados toman sin límite durante el horario contratado. Costo 100% predecible según
                  los invitados confirmados.
                </p>

                <ul className="mt-6 space-y-2.5 border-t border-[#242E37] pt-5 text-xs text-[#F5F2EB]">
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">✓</span> Servicio continuo de 4 horas
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">✓</span> Barra libre de cócteles del menú
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">✓</span> Hora extra con costo adicional acordado previamente
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">✓</span> Más viáticos según ubicación
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t border-[#242E37] pt-5">
                <a href="#simulador" className={styles.btnPrimary}>
                  <span>Calcular Barra Libre en el Simulador ↓</span>
                </a>
              </div>
            </div>

            {/* Tarjeta 2: Barra a Consumo */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[#242E37] bg-gradient-to-b from-[#141B22] to-[#0E1318] p-6 sm:p-8 hover:border-[#D4AF37]/60 transition-all">
              <div className="absolute right-4 top-4 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                PAGO EXACTO
              </div>

              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                  Modalidad 02
                </span>
                <h3 className="mt-1 font-serif text-3xl font-bold text-[#F5F2EB]">
                  Barra a Consumo
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-serif text-5xl font-extrabold text-[#D4AF37]">$250</span>
                  <span className="font-mono text-sm font-semibold text-[#9AA5AC]">
                    MXN por hora de atención + producto consumido
                  </span>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[#D2DAE0] sm:text-sm">
                  Solo se paga lo que realmente se consume; al final del evento se hace el conteo de botellas
                  y vasos frente a ti.
                </p>

                <ul className="mt-6 space-y-2.5 border-t border-[#242E37] pt-5 text-xs text-[#F5F2EB]">
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">✓</span> Atención y servicio de barra por hora ($250/hr)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">✓</span> Lista fija de precios por insumo consumido
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">✓</span> El inventario inicial no es cobro fijo: si no se consume, no se paga
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">✓</span> Más viáticos según ubicación
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t border-[#242E37] pt-5">
                <a href="#simulador" className={styles.btnSecondary}>
                  <span>Ver Precios por Insumo y Calcular ↓</span>
                </a>
              </div>
            </div>
          </div>

          {/* Comparativa Oficial: Qué Incluye y Qué No Incluye */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-[#242E37] bg-[#0E1318]">
            <div className="border-b border-[#242E37] bg-[#141B22] px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#E28735]">
              En las Dos Modalidades: Barra Libre y Barra a Consumo
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 sm:p-8">
              <div>
                <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#30D158]">
                  <span>✓</span> Incluye
                </h4>
                <ul className="mt-3 space-y-2 text-xs text-[#D2DAE0] sm:text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">●</span> <strong>Personal de preparación:</strong> Bartenders profesionales dedicados a la barra.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">●</span> <strong>Bebidas:</strong> Tequila blanco, reposado, licores y sangría.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">●</span> <strong>Mezcladores, hielo y vasos:</strong> Peñafiel, agua mineral, hielo y vasos de 32 oz.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#30D158]">●</span> <strong>Insumos:</strong> Limón exprimido, sal, salsas, concentrados y chile Tajín.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#FF453A]">
                  <span>✕</span> No Incluye
                </h4>
                <ul className="mt-3 space-y-2 text-xs text-[#9AA5AC] sm:text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-[#FF453A]">●</span> <strong>Meseros:</strong> No contamos con personal de meseros de salón.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#FF453A]">●</span> <strong>Servicio en mesas:</strong> No se reparten bebidas en las mesas.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#FF453A]">●</span> <strong>Distribución de bebidas:</strong> Los invitados acuden directamente a la barra móvil a solicitar sus cócteles.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            3. SIMULADOR Y CALCULADORA EN VIVO (EMBUDO INTERACTIVO)
            ================================================================ */}
        <section className={styles.section} id="simulador" aria-labelledby="calculator-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>02 / CALCULADORA INTERACTIVA</p>
            <h2 id="calculator-title" className={styles.sectionTitle}>
              Calcula el Costo de tu Fiesta <em>en Segundos.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Mueve la barra con tu número de invitados y conoce al instante el total a pagar, el anticipo del 50%
              y los viáticos aplicables.
            </p>
          </div>

          <PricingCalculator />
        </section>

        {/* ================================================================
            4. MENÚ OFICIAL (LAS 7 PREPARACIONES DEL PDF)
            ================================================================ */}
        <section className={styles.section} id="menu" aria-labelledby="catalog-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>03 / MENÚ OFICIAL DE CÓCTELES</p>
            <h2 id="catalog-title" className={styles.sectionTitle}>
              Siete Preparaciones, <em>en Ambas Modalidades.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Todas están disponibles en Barra Libre y en Barra a Consumo. Recetas elaboradas al momento
              con fruta fresca, tequila artesanal y escarchados especiales.
            </p>
          </div>

          <CocktailCatalog onSelectFor3D={setSelectedDrinkId} />
        </section>

        {/* ================================================================
            5. EXPERIENCIA INTERACTIVA: EL VASO EN 3D
            ================================================================ */}
        <section className={styles.section} id="vaso3d" aria-labelledby="glass3d-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>04 / EL VASO OFICIAL 32 OZ</p>
            <h2 id="glass3d-title" className={styles.sectionTitle}>
              Simula tu Bebida en el Vaso 3D <em>(946 ml).</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Gira en 360° para ver el termoformado real, los hielos a tope y el escarchado de cada cóctel.
              Haz clic en cualquiera de las 7 preparaciones para probarla en el vaso.
            </p>
          </div>

          <TequilitrosCup3D selectedDrinkId={selectedDrinkId} onSelectDrink={setSelectedDrinkId} />
        </section>

        {/* ================================================================
            6. CUATRO PASOS PARA RESERVAR & REQUISITOS (PÁGINA 3 DEL PDF)
            ================================================================ */}
        <section className={styles.section} id="pasos" aria-labelledby="steps-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>05 / CÓMO CONTRATAR</p>
            <h2 id="steps-title" className={styles.sectionTitle}>
              Cuatro Pasos para <em>Reservar la Barra.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Proceso simple, claro y sin sorpresas. Desde el primer mensaje de WhatsApp hasta el día de tu evento.
            </p>
          </div>

          <BookingSteps />
        </section>

        {/* ================================================================
            7. GALERÍA & VIDEO EN VIVO DE LA BARRA
            ================================================================ */}
        <section className={styles.section} id="galeria" aria-labelledby="gallery-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>06 / MONTAJE EN VIVO</p>
            <h2 id="gallery-title" className={styles.sectionTitle}>
              El Ambiente de la Barra Móvil <em>en tu Fiesta.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Así luce nuestro módulo de barra rústica de madera atendido por bartenders uniformados.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 items-center mb-12">
            <div className="lg:col-span-7">
              <VideoPlayer
                src="/tequilitros/barra-movil-tequilitros.mp4"
                poster="/tequilitros/cantarito.jpg"
              />
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#E28735]">
                  Montaje Rústico
                </span>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F5F2EB]">
                  Barra de Madera Artesanal
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  Diseñada para lucir espectacular en jardines, salones, haciendas y terrazas. Montamos con 1.5 a 2 horas de anticipación.
                </p>
              </div>

              <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  Servicio Fluido
                </span>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F5F2EB]">
                  Bartenders Dedicados
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  Preparación ágil para evitar filas largas, garantizando que cada vaso salga con la temperatura perfecta y escarchado recién hecho.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            8. COBERTURA GEOGRÁFICA Y TRASLADOS
            ================================================================ */}
        <section className={styles.section} id="cobertura" aria-labelledby="travel-title">
          <div className={styles.logisticsGrid}>
            <div>
              <p className={styles.sectionNo}>07 / COBERTURA Y LOGÍSTICA</p>
              <h2 id="travel-title" className={styles.sectionTitle}>
                Base en Colotlán, <em>Llegamos a tu Municipio.</em>
              </h2>
              <p className={styles.sectionSubtitle}>
                Trasladamos la barra móvil completa, insumos y personal a eventos en:
              </p>

              <ul className={styles.coverageList}>
                {serviceAreas.map((area, i) => (
                  <li key={i}>
                    <span>✳</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.travelCards}>
              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 01</div>
                <h3>Viáticos Claros y Fijos</h3>
                <p>
                  Desde $0 en Colotlán hasta $500 en Tlaltenango/Jerez o $800 en Zacatecas/Fresnillo. Todo por escrito antes de pagar.
                </p>
              </article>

              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 02</div>
                <h3>Montaje Puntual</h3>
                <p>
                  Llegamos de 1.5 a 2 horas antes para armar la barra, enfriar insumos y dejar todo listo para el primer brindis.
                </p>
              </article>

              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 03</div>
                <h3>Sin Sorpresas</h3>
                <p>
                  Solo se consideran gastos adicionales cuando la distancia o el horario requieran hospedaje acordado previamente.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ================================================================
            9. PREGUNTAS FRECUENTES (OBJECIONES DERRIBADAS)
            ================================================================ */}
        <section className={styles.section} id="faq" aria-labelledby="faq-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>08 / DUDAS FRECUENTES</p>
            <h2 id="faq-title" className={styles.sectionTitle}>
              Todo lo que Necesitas Saber <em>Antes de Contratar.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Respuestas directas a las preguntas más comunes de los anfitriones.
            </p>
          </div>

          <div className={styles.faqGrid}>
            {faqList.map((item, index) => (
              <details key={index} className={styles.faqItem}>
                <summary>
                  <span>{item.q}</span>
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ================================================================
            10. FORMULARIO DE COTIZACIÓN DIRECTA (EVENT QUOTE)
            ================================================================ */}
        <EventQuote />

        {/* ================================================================
            11. REDES SOCIALES Y CONTACTO
            ================================================================ */}
        <section className={styles.section} id="contacto" aria-labelledby="social-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>10 / ATENCIÓN DIRECTA</p>
            <h2 id="social-title" className={styles.sectionTitle}>
              Hablemos de <em>tu Celebración.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Escríbenos o llámanos. Te respondemos al momento para revisar la fecha de tu evento.
            </p>
          </div>

          <div className={styles.socialActions}>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialButton}
            >
              <div>
                <span>WhatsApp Oficial</span>
                <strong>56 6298 9202 ↗</strong>
              </div>
              <span className="text-2xl text-[#30D158]">💬</span>
            </a>

            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialButton}
            >
              <div>
                <span>Instagram Oficial</span>
                <strong>@tequilitros_eventos ↗</strong>
              </div>
              <span className="text-2xl text-[#E28735]">📸</span>
            </a>
          </div>
        </section>
      </main>

      {/* ================================================================
          12. FOOTER EDITORIAL
          ================================================================ */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <span>✳</span> TEQUILITROS · BARRA MÓVIL PARA EVENTOS
        </div>

        <div className="text-center font-mono text-[11px] text-[#5D6B75] max-w-xl mx-auto space-y-1">
          <p>© {new Date().getFullYear()} DESTILADORA DEL NORTE · COLOTLÁN, JALISCO, MÉXICO</p>
          <p className="text-[10px] text-[#424F58]">
            Dos modalidades: Barra Libre ($90/persona) y Barra a Consumo ($250/hr). Eventos desde 40 personas.
          </p>
        </div>

        <div className={styles.footerLinks}>
          <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
            Facebook
          </a>
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <Link href="/privacy-policy">Aviso de Privacidad</Link>
        </div>
      </footer>

      {/* Botón Flotante Permanente de WhatsApp */}
      <FloatingWhatsApp />
    </div>
  );
}
