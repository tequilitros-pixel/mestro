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
  "Colotlán y la zona norte de Jalisco (zona base)",
  "Municipios cercanos de Jalisco, sujeto a fecha y cobertura",
  "Zacatecas y localidades cercanas, sujeto a fecha y cobertura",
  "Otras localidades de la región bajo consulta previa de agenda",
];

const faqList = [
  {
    q: "¿Qué tipo de eventos atienden con la barra móvil?",
    a: "Atendemos bodas, XV años, cumpleaños, aniversarios, eventos empresariales, festivales y fiestas privadas de cualquier tamaño. Adaptamos el montaje y el número de mixólogos según la cantidad de invitados.",
  },
  {
    q: "¿Cómo se compone el costo de un evento?",
    a: "No manejamos tarifas fijas rígidas porque cada celebración es distinta. La propuesta se calcula con base en: 1) Número de invitados adultos, 2) Horas de servicio contratadas, 3) Variedad de bebidas elegidas de la carta, y 4) Distancia de traslado desde Colotlán.",
  },
  {
    q: "¿Qué incluye el servicio de Tequilitros?",
    a: "Llevamos la barra móvil física, mixólogos y bartenders profesionales, hielo gourmet suficiente, fruta fresca seleccionada del día, escarchados artesanales (sal de grano, chile, chamoy), equipo de bar y los vasos de servicio (como nuestro vaso insignia Reyma 32 EU de 1 litro).",
  },
  {
    q: "¿Cómo funcionan los traslados y viáticos fuera de Colotlán?",
    a: "Partimos desde nuestra destilería en Colotlán, Jalisco. Para traslados foráneos calculamos únicamente los costos directos proporcionales de combustible, peajes de casetas y logística de transporte. Si el evento termina en la madrugada y la distancia no permite un retorno seguro, se acuerda previamente el apoyo de hospedaje. Todo se detalla con total transparencia en la cotización antes de cualquier anticipo.",
  },
  {
    q: "¿Ofrecen opciones para personas que no toman alcohol o menores?",
    a: "Sí. Preparamos versiones especiales sin alcohol (mocktails) con la misma frescura de cítricos naturales, refresco de toronja, pulpas de fruta y escarchados festivos para que todos los invitados disfruten por igual.",
  },
  {
    q: "¿Con cuánta anticipación debo reservar mi fecha?",
    a: "Recomendamos apartar con la mayor anticipación posible (especialmente para fines de semana en temporada alta de bodas y festividades de fin de año). Puedes consultar disponibilidad de fecha sin compromiso por WhatsApp.",
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
        areaServed: ["Jalisco", "Zacatecas", "Colotlán"],
        sameAs: [whatsappUrl, facebookUrl, instagramUrl],
      },
      {
        "@type": "LocalBusiness",
        "@id": `${siteUrl}/tequilitros#business`,
        name: "Tequilitros - Barra Móvil y Mixología para Eventos",
        description: "Servicio profesional de barra móvil, cantaritos de 1 litro y coctelería con tequila de la casa para bodas y celebraciones.",
        url: `${siteUrl}/tequilitros`,
        telephone: "+52 56 6298 9202",
        email: "tequilitros@gmail.com",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Colotlán",
          addressRegion: "Jalisco",
          addressCountry: "MX",
        },
        areaServed: ["Colotlán", "Norte de Jalisco", "Zacatecas"],
        priceRange: "$$",
      },
      {
        "@type": "Service",
        name: "Barra Móvil y Mixología para Eventos",
        provider: { "@id": `${siteUrl}/tequilitros#organization` },
        serviceType: "Coctelería y barra móvil de eventos",
        areaServed: ["Jalisco", "Zacatecas"],
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
              alt="Cantarito Tequilitros de 1 litro frente a una barrica de roble"
              fill
              priority
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
              Llevamos el sabor, la frescura y el carácter de nuestra destilería
              a tu fiesta. Cantaritos de 1 litro, mixología de autor y un servicio
              artesanal inolvidable para bodas y celebraciones en Jalisco y Zacatecas.
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
                <strong>✳ 100%</strong> Agave de la Casa
              </span>
              <span>
                <strong>1L</strong> Vaso Reyma 32 EU
              </span>
              <span>
                <strong>Base</strong> Colotlán, Jalisco
              </span>
            </div>
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
          <span>CANTARITOS DE 1 LITRO</span>
          <b>✳</b>
          <span>BARRA MÓVIL PROFESIONAL</span>
          <b>✳</b>
          <span>MIXOLOGÍA ARTESANAL</span>
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
                  Tequilitros nace del corazón de <strong>Destiladora del Norte</strong>,
                  en Colotlán, Jalisco. No somos intermediarios ni una agencia de eventos
                  genérica: somos destiladores y apasionados de la hospitalidad mexicana.
                </p>
                <p>
                  Llevamos a tu fiesta nuestra propia barra móvil de madera y hierro,
                  bartenders profesionales capacitados y bebidas elaboradas con tequila
                  y licores producidos en nuestra casa destiladora.
                </p>
                <p>
                  Desde un cantarito bien escarchado para brindar con amigos hasta un tequila
                  reposado servido con calma, cuidamos cada detalle para que tus invitados
                  vivan una experiencia auténtica y memorable.
                </p>
              </div>
            </div>

            <div>
              <div className={styles.aboutHighlights}>
                <div className={styles.highlightCard}>
                  <h4>Destilería Propia</h4>
                  <p>Tequila y licores elaborados en alambique tradicional en Colotlán.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>Fruta Fresca del Día</h4>
                  <p>Cítricos recién exprimidos y pulpas naturales en cada preparación.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>Formato de 1 Litro</h4>
                  <p>El icónico vaso Reyma 32 EU con escarchado de sal de grano y chile.</p>
                </div>
                <div className={styles.highlightCard}>
                  <h4>Montaje Completo</h4>
                  <p>Barra móvil, hielos, cristalería, desechables y equipo humano.</p>
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
              Nuestra carta incluye preparaciones insignia, opciones frutales de autor
              y botellas directas de la destilería. Puedes combinar las recetas que mejor
              se adapten al perfil de tus invitados.
            </p>
          </div>

          <CocktailCatalog />
        </section>

        {/* ================================================================
            4. EXPERIENCIA 3D: VASO REYMA 32 EU (946 ML)
            ================================================================ */}
        <section className={styles.section} id="vaso3d" aria-labelledby="glass3d-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionNo}>03 / NUESTRO FORMATO INSIGNIA</p>
            <h2 id="glass3d-title" className={styles.sectionTitle}>
              El Vaso Tequilitros <em>en 3D.</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Conoce en detalle el vaso termoformado Reyma 32 EU de casi 1 litro
              con el que servimos en cada evento. Interactúa en 360°, revisa sus dimensiones
              de ingeniería y cambia el sabor para ver cómo luce preparado.
            </p>
          </div>

          <TequilitrosCup3D />
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
              Flexibilidad total para adaptarnos al formato de tu fiesta, salón,
              rancho o terraza.
            </p>
          </div>

          <div className={styles.servicesGrid}>
            <article className={styles.serviceCard}>
              <div className={styles.serviceCardHeader}>
                <span>Modalidad 01 · La Más Popular</span>
                <h3>Barra Libre por Horas</h3>
                <p>
                  Servicio continuo e ilimitado de cócteles preparados al momento
                  durante el bloque de tiempo contratado (ej. 3, 4 o 5 horas).
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Preparación continua al momento</li>
                <li><span>✓</span> Mixólogos y bartenders en vivo</li>
                <li><span>✓</span> Carta de 3 a 5 cócteles a elegir</li>
                <li><span>✓</span> Hielos, fruta e insumos ilimitados</li>
                <li><span>✓</span> Ideal para bodas y XV años</li>
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
                  Contratas un volumen específico de litros o número de vasos Reyma
                  preparados para tu evento, manteniendo el control del presupuesto.
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Paquetes fijados por cantidad de vasos</li>
                <li><span>✓</span> Montaje y servicio de barra incluido</li>
                <li><span>✓</span> Control de entrega por tickets o pulseras</li>
                <li><span>✓</span> Opción de recarga adicional en el evento</li>
                <li><span>✓</span> Ideal para tornabodas y reuniones medianas</li>
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
                  Cajas o botellas individuales de Tequila Blanco y Reposado de
                  Destiladora del Norte para servicio directo en mesas y degustación.
                </p>
              </div>

              <ul className={styles.serviceFeatures}>
                <li><span>✓</span> Tequila 100% Agave directo del alambique</li>
                <li><span>✓</span> Presentaciones de 750 ml selladas</li>
                <li><span>✓</span> Cantaritos de barro artesanales opcionales</li>
                <li><span>✓</span> Precio especial por volumen de evento</li>
                <li><span>✓</span> Excelente recuerdo para invitados</li>
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
            <p className={styles.sectionNo}>05 / TRANSPARENCIA TOTAL</p>
            <h2 id="pricing-title" className={styles.sectionTitle}>
              ¿Cómo calculamos tu <em>propuesta?</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              No creemos en paquetes inflexibles ni en costos ocultos de última hora.
              Cada presupuesto se arma a la medida considerando cuatro factores:
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 01</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Número de Invitados</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Determinamos el volumen necesario de fruta, tequila, hielo y vasos para que nadie se quede sin servicio.
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 02</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Horas de Barra</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                El tiempo pactado de servicio activo durante tu fiesta (típicamente entre 3 y 6 horas).
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 03</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Carta de Bebidas</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Las recetas seleccionadas (cantaritos clásicos, especialidades de autor o tequilas premium).
              </p>
            </div>

            <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
              <span className="font-mono text-xs font-bold text-[#E28735]">FACTOR 04</span>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#F5F2EB]">Logística de Traslado</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                Distancia desde Colotlán, peajes y requerimientos de transporte del mobiliario.
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
                De Colotlán a donde esté <em>tu fiesta.</em>
              </h2>
              <p className={styles.sectionSubtitle}>
                Partimos desde nuestra base en Colotlán, Jalisco. Atendemos con gusto
                eventos en toda la región norte de Jalisco y el estado de Zacatecas.
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
                  Calculamos el costo de traslado real sin sobreprecios arbitrarios.
                  Si tu evento está en la zona base de Colotlán, el costo logístico es mínimo.
                </p>
              </article>

              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 02</div>
                <h3>Montaje Anticipado</h3>
                <p>
                  Llegamos de 1.5 a 2 horas antes de que comience tu evento para montar
                  la barra, enfriar insumos y verificar que todo esté impecable cuando llegue el primer invitado.
                </p>
              </article>

              <article className={styles.travelCard}>
                <div className={styles.travelCardNumber}>CRITERIO 03</div>
                <h3>Viáticos Transparentes</h3>
                <p>
                  Casetas de peaje o apoyo de hospedaje solo aplican cuando la distancia y el horario
                  nocturno impiden un retorno seguro a carretera. Todo queda asentado en la propuesta.
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
              Conoce nuestra barra física, el montaje real en eventos y los momentos
              que compartimos con los invitados.
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
                  Barra de Madera y Hierro
                </span>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F5F2EB]">
                  Presencia visual que viste tu evento
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  Diseñada con acabados rústicos contemporáneos que combinan perfecto
                  con jardines, haciendas, salones elegantes y terrazas al aire libre.
                </p>
              </div>

              <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  Servicio Rápido y Fluido
                </span>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F5F2EB]">
                  Sin filas interminables
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  Nuestros bartenders trabajan con pre-mise en place optimizado para
                  servir cócteles fríos y escarchados en cuestión de segundos.
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
            <div className={styles.socialPhoto}>
              <Image
                src="/tequilitros/vampiro.jpg"
                alt="Vampiro Tequilitros preparado para evento"
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            </div>
            <div className={styles.socialPhoto}>
              <Image
                src="/tequilitros/paloma.jpg"
                alt="Paloma tradicional con escarchado"
                fill
                sizes="(max-width: 768px) 50vw, 30vw"
              />
            </div>
            <div className={styles.socialPhoto}>
              <Image
                src="/tequilitros/cantarito.jpg"
                alt="Cantarito frente a barrica de tequila"
                fill
                sizes="(max-width: 768px) 50vw, 30vw"
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
                Escríbenos directamente o llámanos. Te confirmamos cobertura,
                disponibilidad de agenda y opciones para tu evento en minutos.
              </p>
            </div>

            <div className={styles.contactCard}>
              <div className={styles.contactCardHeader}>Atención Personalizada</div>
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
                Tequilitros es una marca registrada de Destiladora del Norte.
                Contenido y servicios dirigidos exclusivamente a personas mayores de edad (+18).
                Consumo responsable.
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
