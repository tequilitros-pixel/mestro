import Image from "next/image";
import Link from "next/link";
import styles from "./tequilitros.module.css";
import EventQuote from "./EventQuote";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maestro-destiladora.space";
const whatsappUrl =
  "https://wa.me/525662989202?text=" +
  encodeURIComponent("Hola, quiero información de Tequilitros para mi evento.");

const facebookUrl = "https://www.facebook.com/profile.php?id=1348925031634852";
const instagramUrl = "https://www.instagram.com/tequilitros_eventos/";

const cocktailMenu = [
  { name: "Cantarito", description: "Cítrico, refrescante y con el sello de la casa.", image: "/tequilitros/cantarito.jpg" },
  { name: "Paloma", description: "Toronja, limón y tequila para brindar sin complicaciones.", image: "/tequilitros/paloma.jpg" },
  { name: "Vampiro", description: "Un clásico de la región con color y carácter.", image: "/tequilitros/vampiro.jpg" },
  { name: "Tequimango", description: "El lado frutal de Tequilitros.", image: "/tequilitros/tequimango.jpg" },
  { name: "Tequimiche", description: "Una opción preparada con notas saladas y especiadas.", image: "/tequilitros/tequimiche.jpg" },
  { name: "Tequimora", description: "Zarzamora y tequila en una combinación intensa.", image: "/tequilitros/zarzamora.jpg" },
  
  
];

const bottleMenu = [
  { name: "Tequila Blanco", image: "/tequilitros/blanco.jpg", text: "Perfil limpio y versátil para servir solo o preparar bebidas." },
  { name: "Tequila Reposado", image: "/tequilitros/reposado.jpg", text: "Una expresión con más tiempo y carácter para la mesa." },

];

const serviceAreas = [
  "Colotlán y la zona norte de Jalisco",
  "Municipios cercanos de Jalisco",
  "Zacatecas y localidades cercanas, sujeto a fecha y cobertura",
];

const faq = [
  ["¿Qué tipo de eventos atendemos?", "Bodas, cumpleaños, celebraciones familiares, eventos empresariales y reuniones que quieran sumar una barra con identidad."],
  ["¿Pueden atender fuera de Colotlán?", "Sí, revisamos cada solicitud por fecha, localidad y alcance del servicio. Escríbenos desde Jalisco, Zacatecas o zonas cercanas para confirmar cobertura."],
  ["¿Cómo solicito una cotización?", "Envíanos la fecha, lugar, tipo de evento y número aproximado de invitados por WhatsApp. Te responderemos con las opciones disponibles."],
  ["¿La carta y los precios son fijos?", "La disponibilidad, presentación y precio se confirman para cada evento. La carta pública muestra referencias de bebidas, no sustituye una cotización."],
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/tequilitros#organization`,
        name: "Tequilitros",
        alternateName: "Destiladora del Norte",
        url: `${siteUrl}/tequilitros`,
        logo: `${siteUrl}/icon-192.png`,
        email: "tequilitros@gmail.com",
        telephone: "+52 56 6298 9202",
        areaServed: ["Jalisco", "Zacatecas", "Colotlán"],
        sameAs: ["https://wa.me/525662989202", facebookUrl, instagramUrl],
      },
      {
        "@type": "LocalBusiness",
        "@id": `${siteUrl}/tequilitros#business`,
        name: "Tequilitros",
        description: "Bebidas, licores y barra móvil para eventos.",
        url: `${siteUrl}/tequilitros`,
        telephone: "+52 56 6298 9202",
        email: "tequilitros@gmail.com",
        address: { "@type": "PostalAddress", addressLocality: "Colotlán", addressRegion: "Jalisco", addressCountry: "MX" },
        areaServed: ["Colotlán", "Norte de Jalisco", "Zacatecas"],
        priceRange: "$$",
      },
      {
        "@type": "Service",
        name: "Barra móvil para eventos",
        provider: { "@id": `${siteUrl}/tequilitros#organization` },
        serviceType: "Barra móvil y bebidas para eventos",
        areaServed: ["Jalisco", "Zacatecas"],
        availableChannel: { "@type": "ServiceChannel", serviceUrl: whatsappUrl },
      },
      {
        "@type": "ItemList",
        name: "Bebidas Tequilitros",
        itemListElement: cocktailMenu.map((drink, index) => ({ "@type": "ListItem", position: index + 1, name: drink.name, description: drink.description })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
      },
    ],
  };
}

export default function TequilitrosPage() {
  return (
    <div className={styles.site}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, "\\u003c") }} />
      <div className={styles.topbar}><span>COLOTLÁN · JALISCO</span><span>TEQUILITROS · DESTILADORA DEL NORTE · BARRA MÓVIL</span></div>
      <header className={styles.header}>
        <Link href="#inicio" className={styles.logo} aria-label="Tequilitros, inicio"><span aria-hidden="true">✳</span> TEQUILITROS</Link>
        <nav className={styles.nav} aria-label="Navegación pública de Tequilitros">
          <Link href="#nosotros">La experiencia</Link><Link href="#bebidas">Bebidas</Link><Link href="#menu">Catálogo</Link><Link href="#cobertura">Cobertura</Link><Link href="#cotizar">Cotizador</Link>
        </nav>
        <a className={styles.headerButton} href={whatsappUrl} target="_blank" rel="noopener noreferrer">Cotiza tu evento <span>↗</span></a>
      </header>

      <main>
        <section className={styles.hero} id="inicio">
          <div className={styles.heroCopy}><p className={styles.kicker}>TEQUILITROS PARA EVENTOS · COLOTLÁN, JALISCO</p><h1>La fiesta empieza con <em>un Tequilitro.</em></h1><p className={styles.lead}>Llevamos nuestros sabores, nuestra barra y una experiencia memorable a tu celebración. Descubre lo que podemos preparar para tu evento.</p><div className={styles.heroActions}><a className={styles.button} href={whatsappUrl} target="_blank" rel="noopener noreferrer">Cotiza tu evento <span>↗</span></a><Link className={styles.underLink} href="#bebidas">Descubre nuestras bebidas ↓</Link></div><p className={styles.heroFoot}>BARRA MÓVIL · BEBIDAS PREPARADAS · EVENTOS ESPECIALES</p></div>
          <div className={styles.heroImage}><Image src="/tequilitros/cantarito.jpg" alt="Tequilitro original escarchado, presentado frente a una barrica" fill priority sizes="100vw" /><div className={styles.heroImageLabel}><span>EL SABOR DE NUESTRAS FIESTAS</span><strong>01 / TEQUILITROS</strong></div></div>
        </section>

        <div className={styles.ribbon}><span>HECHO PARA CELEBRAR</span><b>✳</b><span>HECHO PARA COMPARTIR</span><b>✳</b><span>HECHO EN EL NORTE</span></div>

        <section className={styles.intro} id="nosotros"><div className={styles.sectionNo}>01 / QUIÉNES SOMOS</div><div><h2>Una barra con raíz, <em>carácter y cercanía.</em></h2><p>Tequilitros nace alrededor de una forma sencilla de celebrar: bebidas bien preparadas, productos de nuestra casa y un servicio cercano. Somos parte de Destiladora del Norte, en Colotlán, Jalisco.</p><p>Trabajamos para que cada evento tenga una carta que se sienta propia, desde un cantarito para compartir hasta un tequila para disfrutar con calma.</p></div><div className={styles.bigMark}>✳</div></section>

        <section className={styles.videoSection} aria-labelledby="video-title"><div className={styles.videoCopy}><p className={styles.sectionNo}>UNA MIRADA A TEQUILITROS</p><h2 id="video-title">El sabor también <em>se ve.</em></h2><p>Conoce la barra móvil y algunas de las bebidas que llevamos a la mesa. Reproduce el video cuando quieras.</p></div><div className={styles.videoFrame}><video controls preload="metadata" poster="/tequilitros/cantarito.jpg" playsInline><source src="/tequilitros/barra-movil-tequilitros.mp4" type="video/mp4" />Tu navegador no puede reproducir este video.</video></div></section>

        <section className={styles.sectionDark} id="bebidas"><div className={styles.sectionHeader}><div><p className={styles.sectionNo}>02 / BEBIDAS</p><h2>Elige tu <em>favorito.</em></h2></div><p>La carta incluye preparaciones Tequilitros, versiones sin tequila y opciones de la casa. La disponibilidad final se confirma para cada fecha.</p></div><div className={styles.drinkGrid}>{cocktailMenu.map((drink, index) => <article className={styles.drinkCard} key={drink.name}><div className={styles.cardImage}><Image src={drink.image} alt={`${drink.name} Tequilitros`} fill sizes="(max-width: 760px) 45vw, 22vw" /></div><div className={styles.cardMeta}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{drink.name}</h3><p>{drink.description}</p></div><span>↗</span></div></article>)}</div></section>

        <section className={styles.catalog} id="menu"><div className={styles.sectionHeader}><div><p className={styles.sectionNo}>03 / MENÚ Y CATÁLOGO</p><h2>De la barra <em>a la botella.</em></h2></div><p>Consulta el menú disponible para tu evento: preparaciones, tequilas y licores de la casa. Podemos adaptar la propuesta al tipo de celebración y lugar.</p></div><div className={styles.bottleGrid}>{bottleMenu.map((bottle) => <article className={styles.bottleCard} key={bottle.name}><div className={styles.bottleImage}><Image src={bottle.image} alt={bottle.name} fill sizes="(max-width: 760px) 90vw, 30vw" /></div><div><h3>{bottle.name}</h3><p>{bottle.text}</p></div></article>)}</div><div className={styles.catalogList}><div><span>PREPARACIONES</span><strong>Vampiro · Cantarito · Paloma · Tequimiche · Tequimora · Tequimojito · Coscorrón</strong></div><div><span>LICORES</span><strong>Mango · Jamaica · Zarzamora · Menta · Café</strong></div><div><span>FORMATOS</span><strong>Barra libre · Barra a consumo · Servicio para evento · Botella</strong></div></div><p className={styles.disclaimer}>Los nombres y opciones corresponden al catálogo operativo de Tequilitros. Precios, cantidades, inventario y disponibilidad se confirman en la cotización; no se genera una reserva automática desde esta página.</p></section>

        <section className={styles.process}><div className={styles.processCopy}><p className={styles.sectionNo}>04 / CÓMO TRABAJAMOS</p><h2>Tu fecha primero.<br /><em>El sabor después.</em></h2><p>Cuéntanos lo básico de tu evento y te ayudamos a elegir una propuesta que tenga sentido para tus invitados, tu localidad y el tipo de celebración.</p><a className={styles.outlineButton} href={whatsappUrl} target="_blank" rel="noopener noreferrer">Empezar por WhatsApp <span>↗</span></a></div><div className={styles.steps}><div><b>01</b><h3>Cuéntanos la fecha</h3><p>Fecha, localidad, tipo de evento e invitados aproximados.</p></div><div><b>02</b><h3>Armamos la propuesta</h3><p>Revisamos cobertura, carta y modalidad de servicio.</p></div><div><b>03</b><h3>Recibe tu cotización</h3><p>Te respondemos por WhatsApp con los detalles confirmados.</p></div></div></section>

        <section className={styles.coverage} id="cobertura"><div><p className={styles.sectionNo}>05 / DÓNDE ATENDEMOS</p><h2>De Colotlán<br />para <em>tu celebración.</em></h2></div><div><p className={styles.coverageLead}>Atendemos eventos en nuestra región y revisamos solicitudes de Jalisco, Zacatecas y localidades cercanas.</p><ul>{serviceAreas.map((area) => <li key={area}><span>✳</span>{area}</li>)}</ul><p className={styles.coverageNote}>La cobertura depende de la fecha, el lugar y el alcance del servicio. Escríbenos para confirmar antes de anunciar tu evento.</p></div></section>

        <section className={styles.travelSection} id="viaticos">
          <div><p className={styles.sectionNo}>06 / COBERTURA Y TRASLADOS</p><h2>Vamos hasta donde <em>esté la fiesta.</em></h2><p>Partimos de Colotlán, Jalisco. Para eventos fuera de nuestra zona base, revisamos la ruta, la duración del servicio y las necesidades de personal antes de confirmar el presupuesto.</p></div>
          <div className={styles.travelCards}>
            <article><span>01</span><h3>Distancia y traslado</h3><p>Consideramos destino, recorrido y transporte necesario. El costo se especifica en la propuesta, cuando aplique.</p></article>
            <article><span>02</span><h3>Duración y personal</h3><p>El horario del evento y la modalidad solicitada determinan el equipo humano y la logística.</p></article>
            <article><span>03</span><h3>Viáticos transparentes</h3><p>Casetas, alimentación u hospedaje se consideran únicamente si son necesarios y se informan antes de contratar.</p></article>
          </div>
          <p className={styles.travelNote}>No existe una tarifa universal publicada por kilómetro. Para conocer un importe exacto, envíanos los datos en el cotizador.</p>
        </section>
        <section className={styles.faq} id="preguntas"><div className={styles.sectionHeader}><div><p className={styles.sectionNo}>06 / PREGUNTAS FRECUENTES</p><h2>Lo que conviene <em>saber.</em></h2></div><p>Información clara para empezar a planear.</p></div><div className={styles.faqGrid}>{faq.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>

        <EventQuote />
        <section className={styles.contact} id="contacto"><div><p className={styles.sectionNo}>07 / HABLEMOS DE TU EVENTO</p><h2>¿Ya tienes <em>fecha?</em></h2><p>Escríbenos con fecha y lugar. Te confirmamos cobertura y opciones disponibles.</p></div><div className={styles.contactCard}><p>CONTACTO DIRECTO</p><a href={whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp <span>↗</span></a><a href="tel:+525662989202">56 6298 9202</a><a href="mailto:tequilitros@gmail.com">tequilitros@gmail.com</a><small>Contenido dirigido a personas mayores de edad. Consume con moderación.</small></div></section>
      </main>

      <footer className={styles.footer}><div className={styles.footerTop}><Link href="#inicio" className={styles.logo}><span>✳</span> TEQUILITROS</Link><div><a href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook de Tequilitros para Eventos">Facebook ↗</a><a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram de Tequilitros para Eventos">Instagram ↗</a><a href={whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a></div></div><div className={styles.footerBottom}><span>COLOTLÁN · JALISCO · MÉXICO</span><span>© {new Date().getFullYear()} TEQUILITROS · DESTILADORA DEL NORTE</span><Link href="/privacy-policy">Privacidad</Link></div></footer>
    </div>
  );
}
