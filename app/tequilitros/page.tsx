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

const siteUrl = "https://www.destiladoradelnorte.com";
const whatsappUrl =
  "https://wa.me/525662989202?text=" +
  encodeURIComponent("Hola, quiero cotizar Tequilitros para mi evento.");

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
    q: "¿Qué incluye el servicio de barra móvil y bartender de Tequilitros Eventos?",
    a: "El alcance se define por escrito en cada cotización. Puede incluir barra móvil, personal de servicio, vasos, hielo, fruta, escarchados y las bebidas elegidas, conforme a la fecha, localidad y paquete confirmado.",
  },
  {
    q: "¿Cómo contratar una barra móvil con bartender para bodas, XV años o fiestas privadas?",
    a: "Es muy fácil: llena el cotizador en nuestra página web o envíanos un mensaje directo de WhatsApp al 56 6298 9202. Indícanos la fecha, localidad del evento, número estimado de invitados y las bebidas de tu preferencia. Te responderemos con una propuesta personalizada y transparente.",
  },
  {
    q: "¿Cuáles son las bebidas y cócteles que prepara el bartender en los eventos?",
    a: "La carta disponible incluye Cantarito, Paloma, Vampiro, Tequimojito, Tequimora y Tequimiche. Las recetas, botellas e insumos se confirman en la cotización del evento.",
  },
  {
    q: "¿En qué ciudades y localidades de Jalisco y Zacatecas dan servicio de barra móvil?",
    a: "Nuestra base de operaciones está en Colotlán, Jalisco. Atendemos eventos en todo el norte de Jalisco, los cañones y cabeceras de Zacatecas (Jerez, Tlaltenango, Fresnillo, Zacatecas capital), Aguascalientes y solicitudes especiales en la Zona Metropolitana de Guadalajara.",
  },
  {
    q: "¿Cómo funciona la modalidad de Barra Libre por Horas vs. Coctelería por Litros?",
    a: "Barra Libre cubre el bloque de servicio y las condiciones definidas en la cotización. Por Litros o Volumen establece una cantidad acordada de litros o vasos. Ambas modalidades se confirman antes de reservar.",
  },
  {
    q: "¿Ofrecen opciones de cócteles sin alcohol (mocktails) para menores o invitados que no beben?",
    a: "Las alternativas sin alcohol se pueden solicitar al cotizar; se confirman según el menú, la fecha y la disponibilidad de insumos.",
  },
  {
    q: "¿Con cuánta anticipación debo reservar la fecha de mi evento?",
    a: "Comparte la fecha, localidad, invitados estimados y servicio deseado. La disponibilidad y el método de reserva se confirman por escrito antes de cualquier compromiso.",
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
          "Servicio profesional de barra móvil, bartender y coctelería para bodas, XV años, cumpleaños y fiestas privadas. Cantaritos en vaso de 32 oz y mixología premium en Jalisco y Zacatecas.",
        url: `${siteUrl}/tequilitros`,
        telephone: "+52 56 6298 9202",
        email: "tequilitros@gmail.com",
        priceRange: "$$",
        image: `${siteUrl}/tequilitros/productos/cantarito.png`,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Carretera Federal 23 #6 Canoas De Arriba",
          addressLocality: "Colotlán",
          addressRegion: "Jalisco",
          postalCode: "46200",
          addressCountry: "MX",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 22.1158,
          longitude: -103.2642,
        },
        areaServed: [
          { "@type": "AdministrativeArea", name: "Jalisco" },
          { "@type": "AdministrativeArea", name: "Zacatecas" },
          { "@type": "City", name: "Colotlán" },
          { "@type": "City", name: "Tlaltenango" },
          { "@type": "City", name: "Jerez" },
          { "@type": "City", name: "Zacatecas" },
          { "@type": "City", name: "Guadalajara" },
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Servicios de Barra Móvil y Coctelería",
          itemListElement: [
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "Barra Libre Móvil con Bartender por Horas",
                description:
                  "Servicio continuo de cócteles preparados en vivo por bartenders profesionales durante el evento.",
              },
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "Servicio de Coctelería y Cantaritos por Litros",
                description:
                  "Volumen acotado de cantaritos en vaso Reyma 32 oz para cumpleaños y reuniones.",
              },
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "Catering de Tequila y Centros de Mesa",
                description:
                  "Botellas de Tequila Blanco y Reposado Destiladora del Norte para mesas de invitados.",
              },
            },
          ],
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Inicio",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Tequilitros Eventos",
            item: `${siteUrl}/tequilitros`,
          },
        ],
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
              alt="Barra Móvil Tequilitros Eventos - Cantarito frente a barrica de roble"
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
              <span>Barra Móvil · Bartenders Profesionales · Destiladora del Norte</span>
            </div>

            <h1 id="hero-heading" className={styles.heroTitle}>
              Tequilitros Eventos: <em>Barra Móvil, Bartender y Coctelería</em> para tu Celebración
            </h1>

            <p className={styles.heroLead}>
              Llevamos el mejor servicio de <strong>barra móvil</strong>,{" "}
              <strong>bartenders profesionales</strong> y coctelería premium con los famosos{" "}
              <strong>cantaritos en vaso de 32 oz</strong> a tus bodas, XV años, cumpleaños y
              eventos empresariales en Jalisco, Zacatecas y zona norte.
            </p>

            <div className={styles.heroActions}>
              <a href="#cotizar" className={styles.btnPrimary}>
                <span>Cotizar Barra Móvil</span>
                <span aria-hidden="true">↗</span>
              </a>

              <a href="#bebidas" className={styles.btnSecondary}>
                <span>Ver Carta de Cócteles ↓</span>
              </a>
            </div>

            <div className={styles.heroBadges}>
              <span>
                <strong>🍸 Bartender</strong> en Vivo
              </span>
              <span>
                <strong>✳ Barra Móvil</strong> Completa
              </span>
              <span>
                <strong>946 ml</strong> Vaso Reyma 32 oz
              </span>
              <span>
                <strong>📍 Jalisco</strong> & Zacatecas
              </span>
            </div>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.heroHalo} />
            <div className={styles.heroProductAccentOne}>
              <Image
                src="/tequilitros/productos/vampiro.png"
                alt="Cóctel Vampiro con sangrita artesanal para eventos"
                fill
                sizes="(max-width: 1024px) 34vw, 250px"
                className={styles.cutoutImage}
              />
            </div>
            <div className={styles.heroProductAccentTwo}>
              <Image
                src="/tequilitros/productos/paloma.png"
                alt="Paloma tradicional con tequila reposado para bodas"
                fill
                sizes="(max-width: 1024px) 30vw, 220px"
                className={styles.cutoutImage}
              />
            </div>
            <div className={styles.heroProductPrimary}>
              <Image
                src="/tequilitros/productos/cantarito.png"
                alt="Cantarito Tequilitros en vaso de 32 oz para eventos y fiestas"
                fill
                priority
                sizes="(max-width: 1024px) 72vw, 620px"
                className={styles.cutoutImage}
              />
            </div>
            <span className={styles.heroVisualCaption}>Barra Móvil · Tequilitros Eventos</span>
          </div>
        </section>

        {/* ================================================================
            CINTILLO DE IDENTIDAD Y VALORES (KEYWORD TICKER)
            ================================================================ */}
        <div className={styles.tickerRibbon} aria-hidden="true">
          <span>BARRAS MÓVILES PARA EVENTOS</span>
          <b>✳</b>
          <span>SERVICIO DE BARTENDER</span>
          <b>✳</b>
          <span>CANTARITOS 32 OZ (946 ML)</span>
          <b>✳</b>
          <span>DESTILADORA DEL NORTE</span>
          <b>✳</b>
          <span>BODAS Y XV AÑOS</span>
          <b>✳</b>
          <span>COLOTLÁN · JALISCO · ZACATECAS</span>
          <b>✳</b>
          <span>COCTELERÍA MEXICANA PREMIUM</span>
        </div>

        {/* ================================================================
            2. PRESENTACIÓN DE TEQUILITROS (QUIÉNES SOMOS)
            ================================================================ */}
        <section className={styles.section} id="nosotros" aria-labelledby="about-title">
          <div className={styles.aboutGrid}>
            <div>
              <p className={styles.sectionNo}>01 / SOBRE NOSOTROS</p>
              <h2 id="about-title" className={styles.sectionTitle}>
                Servicio de Barra Móvil y Bartenders con Raíz: <em>Tequilitros Eventos.</em>
              </h2>
              <div className={styles.aboutCopy}>
                <p>
                  <strong>Tequilitros Eventos</strong> nace directamente desde{" "}
                  <strong>Destiladora del Norte</strong> en Colotlán, Jalisco. Creamos una
                  experiencia completa de <strong>barra móvil para eventos</strong> pensada para
                  que tú y tus invitados disfruten sin preocuparse por nada.
                </p>
                <p>
                  Nuestros <strong>bartenders y mixólogos</strong> llevan todo el equipo necesario:
                  barra móvil de madera con presencia estética, cristalería y vasos de 32 oz,
                  frutas cítricas del día recién cortadas, hielo abundante y la mejor selección de
                  tequila artesanal.
                </p>
                <p>
                  Desde un cantarito cítrico bien frío con escarchado Tajín hasta una barra libre
                  continua de coctelería para bodas y graduaciones, adaptamos el servicio a las
                  necesidades de tu celebración.
                </p>
              </div>
            </div>

            <div>
              <div className={styles.aboutHighlights}>
                <div className={styles.highlightCard}>
                  <h4>🍸 Bartenders Profesionales</h4>
                  <p>Personal capacitado en servicio al cliente, preparación ágil y atención de barra en fiestas.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>🪵 Barra Móvil Elegante</h4>
                  <p>Módulo de barra móvil de madera que decora y se adapta a jardines, salones y haciendas.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>🏆 Cantaritos en Vaso 32 oz</h4>
                  <p>Servicio en el auténtico vaso Reyma 32 EU (946 ml) con hielo y escarchados artesanales.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>📍 Cobertura Regional</h4>
                  <p>Atención directa en Colotlán, Norte de Jalisco, Zacatecas y solicitudes metropolitanas.</p>
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
            <p className={styles.sectionNo}>02 / MIXOLOGÍA Y COCTELERÍA</p>
            <h2 id="catalog-title" className={styles.sectionTitle}>
              Coctelería y Cantaritos para Eventos: <em>Elige las Bebidas para tus Invitados.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Nuestros <strong>bartenders</strong> preparan cada cóctel al momento frente a tus invitados
              con fruta fresca, tequila artesanal de Destiladora del Norte y escarchados especiales.
              Consulta nuestra carta disponible y personalízala para tu fecha.
            </p>
          </div>

          <CocktailCatalog onSelectFor3D={setSelectedDrinkId} />
        </section>

        {/* ================================================================
            4. EXPERIENCIA 3D: VASO REYMA 32 EU (946 ML)
            ================================================================ */}
        <section className={styles.section} id="vaso3d" aria-labelledby="glass3d-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>03 / VASO OFICIAL 32 OZ</p>
            <h2 id="glass3d-title" className={styles.sectionTitle}>
              El Vaso Tequilitros 946 ml <em>en 3D Interactivo.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Conoce el formato oficial de vaso Reyma 32 EU modelado en 3D con base en las fotos de producto
              de Tequilitros. El formato más solicitado en <strong>barras móviles para bodas y fiestas</strong>,
              con pie escalonado, estrías termoformadas, hielos reales a tope y etiqueta oficial.
            </p>
          </div>

          <TequilitrosCup3D selectedDrinkId={selectedDrinkId} onSelectDrink={setSelectedDrinkId} />
        </section>

        {/* ================================================================
            5. SERVICIOS Y MODALIDADES PARA EVENTOS
            ================================================================ */}
        <section className={styles.section} id="servicios" aria-labelledby="services-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>04 / PAQUETES Y MODALIDADES</p>
            <h2 id="services-title" className={styles.sectionTitle}>
              Paquetes de Barra Móvil y Bartender para <em>Bodas, XV Años y Fiestas.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Modalidades flexibles de contratación de <strong>barras móviles</strong> adaptadas al
              número de invitados, duración y presupuesto de tu evento.
            </p>
          </div>

          <div className={styles.servicesGrid}>
            <article className={styles.serviceCard}>
              <div className={styles.serviceCardHeader}>
                <span>Modalidad 01 · Para Bodas y Graduaciones</span>
                <h3>Barra Libre con Bartender por Horas</h3>
                <p>
                  Servicio de coctelería durante el bloque de tiempo y bajo las condiciones
                  establecidos en la cotización.
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Bartenders profesionales atendiendo la barra</li>
                <li><span>✓</span> Preparación continua durante el horario acordado</li>
                <li><span>✓</span> Montaje y personal según el paquete confirmado</li>
                <li><span>✓</span> Insumos y carta definidos en la cotización</li>
                <li><span>✓</span> Vaso o cristalería según el servicio acordado</li>
              </ul>

              <a href="#cotizar" className={styles.btnSecondary}>
                Cotizar Barra Libre ↗
              </a>
            </article>

            <article className={styles.serviceCard}>
              <div className={styles.serviceCardHeader}>
                <span>Modalidad 02 · Cumpleaños y Fiestas Privadas</span>
                <h3>Servicio de Coctelería por Litros o Volumen</h3>
                <p>
                  Ideal para eventos con consumo definido: contratas un volumen determinado de
                  litros o vasos Reyma de 32 oz preparados con la carta de tu elección.
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Paquete por número exacto de vasos o litros</li>
                <li><span>✓</span> Servicio y montaje conforme al paquete contratado</li>
                <li><span>✓</span> Carta de bebidas confirmada antes del evento</li>
                <li><span>✓</span> Insumos y presentación detallados en la propuesta</li>
                <li><span>✓</span> Recargas sólo si se acuerdan previamente</li>
              </ul>

              <a href="#cotizar" className={styles.btnSecondary}>
                Cotizar por Litros ↗
              </a>
            </article>

            <article className={styles.serviceCard}>
              <div className={styles.serviceCardHeader}>
                <span>Modalidad 03 · Mesas de Honor y Regalos</span>
                <h3>Botellas y Barricas de Tequila</h3>
                <p>
                  Consulta botellas de Tequila Blanco y Reposado de Destiladora del Norte
                  para el servicio, mesas de invitados u obsequios.
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Presentaciones y cantidades por confirmar</li>
                <li><span>✓</span> Disponibilidad sujeta a inventario</li>
                <li><span>✓</span> Servicio directo a mesa si se acuerda</li>
                <li><span>✓</span> Precio y condiciones incluidos en la cotización</li>
                <li><span>✓</span> Entrega conforme a lo acordado</li>
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
            <p className={styles.sectionNo}>05 / PRESUPUESTOS CLAROS</p>
            <h2 id="pricing-title" className={styles.sectionTitle}>
              ¿Cómo Cotizar tu Servicio de <em>Barra Móvil y Bartenders?</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Armamos una cotización a la medida de tu celebración tomando en cuenta estos 4 factores:
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 01</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Número de Invitados</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Estimamos fruta, hielo, vasos y tequila con la información proporcionada para la cotización.
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 02</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Horas de Servicio</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                El bloque de tiempo en que nuestros bartenders estarán preparando cócteles en vivo durante tu fiesta.
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 03</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Carta de Cócteles</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Tú eliges los sabores: cantaritos, palomas, vampiros, mojitos turquesa o tequimiche botanero.
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 04</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Lugar y Traslado</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Revisamos distancia y logística desde Colotlán; los viáticos aplicables se detallan antes de contratar.
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
                Cobertura de Barras Móviles en <em>Jalisco, Zacatecas y Alrededores.</em>
              </h2>
              <p className={styles.sectionSubtitle}>
                Con base en Colotlán, Jalisco, trasladamos nuestra <strong>barra móvil y equipo de bartenders</strong>{" "}
                a salones, haciendas, ranchos, terrazas y jardines en:
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
                <h3>Traslado Seguro y Puntual</h3>
                <p>
                  Revisamos combustible, peajes y necesidades de traslado según la localidad solicitada.
                </p>
              </article>

              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 02</div>
                <h3>Montaje Anticipado</h3>
                <p>
                  El horario de llegada y montaje se acuerda en la propuesta de acuerdo con el lugar y el servicio solicitado.
                </p>
              </article>

              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 03</div>
                <h3>Viáticos Claros por Escrito</h3>
                <p>
                  Si el evento requiere hospedaje o traslados largos, se detalla en la propuesta antes de contratar.
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
              La Barra Móvil en Acción: <em>El Ambiente de Fiesta se Vive.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Conoce la barra y algunas bebidas de Tequilitros. El montaje y el alcance dependen
              de la propuesta confirmada para cada evento.
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
                  Barra móvil para eventos
                </span>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F5F2EB]">
                  Montaje Rústico y Elegante
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  El tipo de montaje y sus elementos se revisan según el espacio y la propuesta solicitada.
                </p>
              </div>

              <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  Servicio de bartender
                </span>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F5F2EB]">
                  Preparación Rápida y Profesional
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  La preparación, los tiempos y el personal se definen según la carta y el alcance acordado.
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
            <p className={styles.sectionNo}>08 / SÍGUENOS EN REDES SOCIALES</p>
            <h2 id="social-title" className={styles.sectionTitle}>
              Tequilitros Eventos en Redes: <em>Momentos que se Comparten.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Sigue nuestras cuentas oficiales de Facebook e Instagram para ver videos de nuestros últimos montajes,
              bodas, fiestas y el ambiente de la barra móvil.
            </p>
          </div>

          <div className={styles.socialGallery}>
            <div className={`${styles.socialPhoto} ${styles.socialProduct}`}>
              <Image
                src="/tequilitros/productos/vampiro.png"
                alt="Servicio de barra móvil Tequilitros - Cóctel Vampiro para fiestas"
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className={styles.cutoutImage}
              />
            </div>
            <div className={`${styles.socialPhoto} ${styles.socialProduct}`}>
              <Image
                src="/tequilitros/productos/paloma.png"
                alt="Bartender para bodas Tequilitros - Paloma tradicional con sal marina"
                fill
                sizes="(max-width: 768px) 50vw, 30vw"
                className={styles.cutoutImage}
              />
            </div>
            <div className={`${styles.socialPhoto} ${styles.socialProduct}`}>
              <Image
                src="/tequilitros/productos/cantarito.png"
                alt="Cantaritos de tequila en vaso de 32 oz para eventos y fiestas"
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
            11. PREGUNTAS FRECUENTES (FAQ PARA SEO Y GOOGLE)
            ================================================================ */}
        <section className={styles.section} id="faq" aria-labelledby="faq-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>09 / RESUELVE TUS DUDAS</p>
            <h2 id="faq-title" className={styles.sectionTitle}>
              Preguntas Frecuentes sobre el Servicio de <em>Barra Móvil y Bartenders.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Todo lo que necesitas saber para contratar la barra de cócteles para tu boda, fiesta o aniversario.
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
                Cotiza la Barra Móvil para <em>tu Evento Hoy.</em>
              </h2>
              <p className={styles.sectionSubtitle}>
                Escríbenos directamente o llámanos. Revisamos disponibilidad de fecha,
                cobertura y presupuesto de forma inmediata.
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
          14. FOOTER EDITORIAL CON ENLACES Y PALABRAS CLAVE
          ================================================================ */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <span>✳</span> TEQUILITROS EVENTOS · BARRAS MÓVILES & BARTENDERS
        </div>

        <div className="text-center font-mono text-[11px] text-[#5D6B75] max-w-xl mx-auto space-y-1">
          <p>© {new Date().getFullYear()} DESTILADORA DEL NORTE · COLOTLÁN, JALISCO, MÉXICO</p>
          <p className="text-[10px] text-[#424F58]">
            Servicio de barra móvil, bartender y coctelería para bodas, XV años y eventos privados en Jalisco y Zacatecas.
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
