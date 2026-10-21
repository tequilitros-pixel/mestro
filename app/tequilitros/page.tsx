"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./tequilitros.module.css";
import Navbar from "./components/Navbar";
import TequilitrosCup3D from "./components/TequilitrosCup3D";
import VideoPlayer from "./components/VideoPlayer";
import CocktailCatalog from "./components/CocktailCatalog";
import EventQuote from "./EventQuote";
import FloatingWhatsApp from "./components/FloatingWhatsApp";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maestro-destiladora.space";
const whatsappUrl =
  "https://wa.me/525662989202?text=" +
  encodeURIComponent("Hola, quiero cotizar Tequilitros para mi evento.");

const facebookUrl = "https://www.facebook.com/profile.php?id=1348925031634852";
const instagramUrl = "https://www.instagram.com/tequilitros_eventos/";

const serviceAreas = [
  "Colotlán, Jalisco",
  "Solicitudes en otras localidades de Jalisco, sujetas a confirmación",
  "Solicitudes en Zacatecas y localidades cercanas, sujetas a confirmación",
];

const faqList = [
  {
    q: "¿Qué tipo de eventos atienden con la barra móvil?",
    a: "Puedes enviarnos solicitudes para bodas, XV años, cumpleaños, aniversarios, eventos empresariales y reuniones. Revisamos el tipo de evento, la localidad y el alcance antes de confirmar.",
  },
  {
    q: "¿Cómo se compone el costo de un evento?",
    a: "La propuesta se prepara con la información del evento: invitados aproximados, fecha, localidad, duración, bebidas solicitadas y necesidades de traslado. Los precios y la disponibilidad se confirman por escrito.",
  },
  {
    q: "¿Qué incluye el servicio de Tequilitros?",
    a: "La carta y el alcance del servicio se definen para cada evento. La disponibilidad de barra, bebidas, hielo, fruta, escarchados, equipo y vasos se confirma en la cotización.",
  },
  {
    q: "¿Cómo funcionan los traslados y viáticos fuera de Colotlán?",
    a: "Tomamos Colotlán, Jalisco como referencia para revisar la logística. Si la localidad requiere traslado, peajes u hospedaje, esos conceptos se revisan y se detallan en la cotización antes de contratar.",
  },
  {
    q: "¿Ofrecen opciones para personas que no toman alcohol o menores?",
    a: "Puedes solicitar opciones sin alcohol. Su disponibilidad y preparación se revisan junto con la carta del evento.",
  },
  {
    q: "¿Con cuánta anticipación debo reservar mi fecha?",
    a: "Envíanos la fecha con anticipación para revisar disponibilidad. La fecha solo queda confirmada cuando ambas partes acuerdan la propuesta y sus condiciones.",
  },
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/tequilitros#organization`,
        name: "Tequilitros para Eventos",
        alternateName: "Destiladora del Norte",
        url: `${siteUrl}/tequilitros`,
        logo: `${siteUrl}/icon-192.png`,
        email: "tequilitros@gmail.com",
        telephone: "+52 56 6298 9202",
        areaServed: ["Colotlán, Jalisco"],
        sameAs: [whatsappUrl, facebookUrl, instagramUrl],
      },
      {
        "@type": "LocalBusiness",
        "@id": `${siteUrl}/tequilitros#business`,
        name: "Tequilitros - Barra Móvil y Mixología para Eventos",
        description: "Bebidas y propuesta de barra móvil para eventos desde Colotlán, Jalisco.",
        url: `${siteUrl}/tequilitros`,
        telephone: "+52 56 6298 9202",
        email: "tequilitros@gmail.com",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Colotlán",
          addressRegion: "Jalisco",
          addressCountry: "MX",
        },
        areaServed: ["Colotlán, Jalisco"],
      },
      {
        "@type": "Service",
        name: "Barra Móvil y Mixología para Eventos",
        provider: { "@id": `${siteUrl}/tequilitros#organization` },
        serviceType: "Coctelería y barra móvil de eventos",
        areaServed: ["Colotlán, Jalisco"],
        availableChannel: {
          "@type": "ServiceChannel",
          serviceUrl: whatsappUrl,
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
            1. PORTADA PRINCIPAL (HERO CINEMATOGRÁFICO)
            ================================================================ */}
        <section className={styles.hero} id="inicio" aria-labelledby="hero-heading">
          <div className={styles.heroBackground}>
            <Image
              src="/tequilitros/cantarito.jpg"
              alt="Cantarito Tequilitros frente a una barrica de roble"
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
              <span>Barra Móvil · Destiladora del Norte · Colotlán, Jal.</span>
            </div>

            <h1 id="hero-heading" className={styles.heroTitle}>
              Tu celebración merece <em>otro sabor.</em>
            </h1>

            <p className={styles.heroLead}>
              Llevamos una carta de bebidas y una propuesta de barra móvil a tu
              celebración. Disponibilidad, localidad y alcance se confirman antes de contratar.
            </p>

            <div className={styles.heroActions}>
              <a
                href="#cotizar"
                className={styles.btnPrimary}
              >
                <span>Cotizar mi evento</span>
                <span aria-hidden="true">↗</span>
              </a>

              <a
                href="#bebidas"
                className={styles.btnSecondary}
              >
                <span>Explorar la carta ↓</span>
              </a>
            </div>

            <div className={styles.heroBadges}>
              <span>
                <strong>✳ Carta</strong> de bebidas
              </span>
              <span>
                <strong>946 ml</strong> Vaso Reyma 32 EU
              </span>
              <span>
                <strong>Base</strong> Colotlán, Jalisco
              </span>
            </div>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.heroHalo} />
            <div className={styles.heroProductAccentOne}>
              <Image
                src="/tequilitros/productos/vampiro.png"
                alt=""
                fill
                sizes="(max-width: 1024px) 34vw, 250px"
                className={styles.cutoutImage}
              />
            </div>
            <div className={styles.heroProductAccentTwo}>
              <Image
                src="/tequilitros/productos/paloma.png"
                alt=""
                fill
                sizes="(max-width: 1024px) 30vw, 220px"
                className={styles.cutoutImage}
              />
            </div>
            <div className={styles.heroProductPrimary}>
              <Image
                src="/tequilitros/productos/cantarito.png"
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 72vw, 620px"
                className={styles.cutoutImage}
              />
            </div>
            <span className={styles.heroVisualCaption}>Carta de sabores · Tequilitros</span>
          </div>
        </section>

        {/* ================================================================
            CINTILLO DE IDENTIDAD Y VALORES
            ================================================================ */}
        <div className={styles.tickerRibbon} aria-hidden="true">
          <span>HECHO PARA CELEBRAR</span>
          <b>✳</b>
          <span>DESTILADORA DEL NORTE</span>
          <b>✳</b>
          <span>COLOTLÁN · JALISCO</span>
          <b>✳</b>
          <span>VASO REYMA 32 EU</span>
          <b>✳</b>
          <span>BARRA MÓVIL</span>
          <b>✳</b>
          <span>CARTA POR CONFIRMAR</span>
        </div>

        {/* ================================================================
            2. PRESENTACIÓN DE TEQUILITROS (QUIÉNES SOMOS)
            ================================================================ */}
        <section className={styles.section} id="nosotros" aria-labelledby="about-title">
          <div className={styles.aboutGrid}>
            <div>
              <p className={styles.sectionNo}>01 / QUIÉNES SOMOS</p>
              <h2 id="about-title" className={styles.sectionTitle}>
                Una barra con raíz, <em>carácter y cercanía.</em>
              </h2>
              <div className={styles.aboutCopy}>
                <p>
                  Tequilitros se presenta desde <strong>Destiladora del Norte</strong>,
                  en Colotlán, Jalisco. Aquí reunimos una carta de bebidas y una propuesta
                  de atención para eventos que se revisa con cada solicitud.
                </p>
                <p>
                  La propuesta puede incluir barra móvil, bebidas, insumos y personal de
                  servicio según la fecha, la localidad y el alcance acordado.
                </p>
                <p>
                  Desde un cantarito hasta una botella de tequila, la carta disponible y
                  las condiciones del servicio se confirman antes de contratar.
                </p>
              </div>
            </div>

            <div>
              <div className={styles.aboutHighlights}>
                <div className={styles.highlightCard}>
                  <h4>Origen de la carta</h4>
                  <p>La propuesta parte de Destiladora del Norte en Colotlán, Jalisco.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>Preparaciones</h4>
                  <p>La selección de cítricos, frutas y escarchados se confirma por evento.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>Formato Reyma 32 EU</h4>
                  <p>El modelo de vaso se muestra en 3D; la presentación se confirma por evento.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>Alcance del servicio</h4>
                  <p>Barra, insumos, equipo y personal se detallan en la cotización.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            3. CATÁLOGO INTERACTIVO DE BEBIDAS
            ================================================================ */}
        <section className={styles.section} id="bebidas" aria-labelledby="catalog-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>02 / MIXOLOGÍA Y CARTA</p>
            <h2 id="catalog-title" className={styles.sectionTitle}>
              Elige las bebidas para <em>tu mesa.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              La carta muestra preparaciones y botellas de referencia. La disponibilidad,
              presentación y combinación se confirman para cada evento.
            </p>
          </div>

          <CocktailCatalog onSelectFor3D={setSelectedDrinkId} />
        </section>

        {/* ================================================================
            4. EXPERIENCIA 3D: VASO REYMA 32 EU (946 ML)
            ================================================================ */}
        <section className={styles.section} id="vaso3d" aria-labelledby="glass3d-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>03 / FORMATO DE VASO</p>
            <h2 id="glass3d-title" className={styles.sectionTitle}>
              El Vaso Tequilitros <em>en 3D.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Conoce el vaso Reyma 32 EU en una experiencia interactiva. Interactúa en
              360° y cambia la bebida mostrada; la presentación final se confirma por evento.
            </p>
          </div>

          <TequilitrosCup3D selectedDrinkId={selectedDrinkId} onSelectDrink={setSelectedDrinkId} />
        </section>

        {/* ================================================================
            5. SERVICIOS Y MODALIDADES PARA EVENTOS
            ================================================================ */}
        <section className={styles.section} id="servicios" aria-labelledby="services-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>04 / MODALIDADES DE CONTRATACIÓN</p>
            <h2 id="services-title" className={styles.sectionTitle}>
              Servicios pensados para <em>tu celebración.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Revisamos el formato de tu fiesta, el lugar y el alcance solicitado.
            </p>
          </div>

          <div className={styles.servicesGrid}>
            <article className={styles.serviceCard}>
              <div className={styles.serviceCardHeader}>
                <span>Modalidad 01 · Por confirmar</span>
                <h3>Barra Libre por Horas</h3>
                <p>
                  Servicio de cócteles preparados durante el bloque de tiempo
                  que se acuerde en la cotización.
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Preparación durante el horario acordado</li>
                <li><span>✓</span> Personal de servicio según cotización</li>
                <li><span>✓</span> Carta de bebidas por definir</li>
                <li><span>✓</span> Hielo, fruta e insumos según alcance</li>
                <li><span>✓</span> Disponible solo al confirmar fecha y localidad</li>
              </ul>

              <a href="#cotizar" className={styles.btnSecondary}>
                Cotizar Barra Libre ↗
              </a>
            </article>

            <article className={styles.serviceCard}>
              <div className={styles.serviceCardHeader}>
                <span>Modalidad 02 · Consumo Acotado</span>
                <h3>Por Litros o Volumen</h3>
                <p>
                  Puedes solicitar un volumen específico de litros o vasos Reyma;
                  la cantidad y el alcance se definen en la cotización.
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Cantidad de vasos o litros por definir</li>
                <li><span>✓</span> Montaje y servicio según cotización</li>
                <li><span>✓</span> Forma de entrega por acordar</li>
                <li><span>✓</span> Recarga solo si se acuerda previamente</li>
                <li><span>✓</span> Disponibilidad sujeta a fecha y localidad</li>
              </ul>

              <a href="#cotizar" className={styles.btnSecondary}>
                Cotizar por Litros ↗
              </a>
            </article>

            <article className={styles.serviceCard}>
              <div className={styles.serviceCardHeader}>
                <span>Modalidad 03 · Centros de Mesa</span>
                <h3>Botellas y Barricas</h3>
                <p>
                  Puedes consultar botellas de Tequila Blanco y Reposado de
                  Destiladora del Norte para tu evento.
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Presentaciones y cantidades por confirmar</li>
                <li><span>✓</span> Disponibilidad sujeta a inventario</li>
                <li><span>✓</span> Servicio directo en mesas si se acuerda</li>
                <li><span>✓</span> Precio incluido en la cotización</li>
                <li><span>✓</span> Condiciones de entrega por definir</li>
              </ul>

              <a href="#cotizar" className={styles.btnSecondary}>
                Consultar Botellas ↗
              </a>
            </article>
          </div>
        </section>

        {/* ================================================================
            6. CÓMO SE COTIZA (TRANSPARENCIA COMERCIAL)
            ================================================================ */}
        <section className={styles.section} id="paquetes" aria-labelledby="pricing-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>05 / CÓMO SE COTIZA</p>
            <h2 id="pricing-title" className={styles.sectionTitle}>
              ¿Cómo calculamos tu <em>propuesta?</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Cada propuesta se prepara con la información disponible del evento y se
              confirma antes de contratar.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 01</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Número de Invitados</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Estimamos el volumen de fruta, tequila, hielo y vasos solicitado para el evento.
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 02</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Horas de Barra</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                El tiempo de servicio que se acuerde para la fecha solicitada.
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 03</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Carta de Bebidas</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Las recetas y botellas seleccionadas de la carta disponible.
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 04</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Logística de Traslado</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Distancia, peajes y necesidades de transporte que correspondan a la localidad.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================
            7 & 8. COBERTURA GEOGRÁFICA Y TRASLADOS / VIÁTICOS
            ================================================================ */}
        <section className={styles.section} id="viaticos" aria-labelledby="travel-title">
          <div className={styles.logisticsGrid}>
            <div>
              <p className={styles.sectionNo}>06 / COBERTURA Y LOGÍSTICA</p>
              <h2 id="travel-title" className={styles.sectionTitle}>
                Desde Colotlán, revisamos <em>tu localidad.</em>
              </h2>
              <p className={styles.sectionSubtitle}>
                Tomamos Colotlán, Jalisco como referencia. Las solicitudes de otras
                localidades de Jalisco, Zacatecas o estados cercanos se revisan por fecha,
                distancia y alcance del servicio.
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
                <h3>Distancia y Combustible</h3>
                <p>
                  Revisamos distancia, combustible y peajes según la localidad solicitada.
                </p>
              </article>

              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 02</div>
                <h3>Montaje Anticipado</h3>
                <p>
                  El horario de llegada y las tareas de montaje se acuerdan en la propuesta
                  de acuerdo con el lugar y el servicio solicitado.
                </p>
              </article>

              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 03</div>
                <h3>Viáticos Transparentes</h3>
                <p>
                  Peajes, traslado u hospedaje se consideran solo cuando correspondan y se
                  detallan en la propuesta antes de contratar.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ================================================================
            9. GALERÍA CINEMATOGRÁFICA & VIDEO EN VIVO
            ================================================================ */}
        <section className={styles.section} id="galeria" aria-labelledby="gallery-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>07 / EXPERIENCIA EN VIVO</p>
            <h2 id="gallery-title" className={styles.sectionTitle}>
              El ambiente también <em>se ve.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Conoce la barra y algunas bebidas de Tequilitros. El montaje y el alcance
              dependen de la propuesta confirmada para cada evento.
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
                  Barra móvil
                </span>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F5F2EB]">
                  Una propuesta visual para tu evento
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  El tipo de montaje y sus elementos se revisan según el espacio y la
                  propuesta solicitada.
                </p>
              </div>

              <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  Servicio de bebidas
                </span>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F5F2EB]">
                  Preparación por confirmar
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  La forma de preparación, los tiempos y el personal se definen según la
                  carta y el alcance acordado.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            10. REDES SOCIALES OFICIALES (METRICOOL VERIFIED)
            ================================================================ */}
        <section className={styles.section} id="redes" aria-labelledby="social-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>08 / SÍGUENOS EN REDES OFICIALES</p>
            <h2 id="social-title" className={styles.sectionTitle}>
              Momentos que se <em>comparten.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Mira fotos y videos de nuestros últimos montajes, fiestas y bebidas
              en nuestras cuentas oficiales de Facebook e Instagram.
            </p>
          </div>

          <div className={styles.socialGallery}>
            <div className={`${styles.socialPhoto} ${styles.socialProduct}`}>
              <Image
                src="/tequilitros/productos/vampiro.png"
                alt="Vampiro Tequilitros preparado para evento"
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className={styles.cutoutImage}
              />
            </div>
            <div className={`${styles.socialPhoto} ${styles.socialProduct}`}>
              <Image
                src="/tequilitros/productos/paloma.png"
                alt="Paloma tradicional con escarchado"
                fill
                sizes="(max-width: 768px) 50vw, 30vw"
                className={styles.cutoutImage}
              />
            </div>
            <div className={`${styles.socialPhoto} ${styles.socialProduct}`}>
              <Image
                src="/tequilitros/productos/cantarito.png"
                alt="Cantarito frente a barrica de tequila"
                fill
                sizes="(max-width: 768px) 50vw, 30vw"
                className={styles.cutoutImage}
              />
            </div>
          </div>

          <div className={styles.socialActions}>
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialButton}
            >
              <div>
                <span>Facebook Oficial</span>
                <strong>Tequilitros para Eventos ↗</strong>
              </div>
              <span className="text-2xl text-[#E28735]">f</span>
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

        {/* ================================================================
            11. PREGUNTAS FRECUENTES (FAQ)
            ================================================================ */}
        <section className={styles.section} id="faq" aria-labelledby="faq-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>09 / RESUELVE TUS DUDAS</p>
            <h2 id="faq-title" className={styles.sectionTitle}>
              Preguntas <em>frecuentes.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Información clara y transparente para ayudarte a planear con tranquilidad.
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
            12. COTIZADOR INTERACTIVO (EVENT QUOTE)
            ================================================================ */}
        <EventQuote />

        {/* ================================================================
            13. CONTACTO DIRECTO
            ================================================================ */}
        <section className={styles.contactSection} id="contacto" aria-labelledby="contact-title">
          <div className={styles.contactGrid}>
            <div>
              <p className={styles.sectionNo}>10 / CONTACTO INMEDIATO</p>
              <h2 id="contact-title" className={styles.sectionTitle}>
                Hablemos de <em>tu fecha.</em>
              </h2>
              <p className={styles.sectionSubtitle}>
                Escríbenos directamente o llámanos. Revisamos cobertura,
                disponibilidad y opciones para tu evento antes de confirmar.
              </p>
            </div>

            <div className={styles.contactCard}>
              <div className={styles.contactCardHeader}>Contacto directo</div>
              <div className={styles.contactLinks}>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contactLink}
                >
                  <div>
                    <span className="font-mono text-xs block text-[#E28735]">WHATSAPP OFICIAL</span>
                    <span>56 6298 9202</span>
                  </div>
                  <span>↗</span>
                </a>

                <a href="tel:+525662989202" className={styles.contactLink}>
                  <div>
                    <span className="font-mono text-xs block text-[#E28735]">LLAMADAS DIRECTAS</span>
                    <span>+52 56 6298 9202</span>
                  </div>
                  <span>📞</span>
                </a>

                <a href="mailto:tequilitros@gmail.com" className={styles.contactLink}>
                  <div>
                    <span className="font-mono text-xs block text-[#E28735]">CORREO ELECTRÓNICO</span>
                    <span>tequilitros@gmail.com</span>
                  </div>
                  <span>✉</span>
                </a>
              </div>

              <p className={styles.legalNotice}>
                Contenido dirigido a personas mayores de edad (+18). Consume con responsabilidad.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ================================================================
          14. FOOTER EDITORIAL
          ================================================================ */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <span>✳</span> TEQUILITROS PARA EVENTOS
        </div>

        <div className="text-center font-mono text-[11px] text-[#5D6B75]">
          <span>© {new Date().getFullYear()} DESTILADORA DEL NORTE · COLOTLÁN, JALISCO, MÉXICO</span>
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
