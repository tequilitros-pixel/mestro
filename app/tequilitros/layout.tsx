import type { Metadata } from "next";

const siteUrl = "https://www.destiladoradelnorte.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tequilitros Eventos | Barra Móvil, Bartender y Coctelería para Eventos",
    template: "%s | Tequilitros Eventos",
  },
  description:
    "Tequilitros Eventos: Servicio profesional de barra móvil, bartender y coctelería para bodas, XV años, cumpleaños y fiestas privadas. Cantaritos de 32 oz y mixología premium en Jalisco, Zacatecas y zona norte. ¡Cotiza tu evento por WhatsApp!",
  keywords: [
    // Búsqueda de Marca Principal
    "Tequilitros Eventos",
    "Tequilitros",
    "Tequilitros oficial",
    "Tequilitros barra móvil",
    "Tequilitros Colotlán",
    // Barras Móviles
    "barra móvil",
    "barras móviles",
    "barra móvil para eventos",
    "barras móviles para eventos",
    "barra móvil para bodas",
    "barra móvil para XV años",
    "barra móvil para fiestas",
    "renta de barra móvil",
    "servicio de barra móvil",
    // Bartender y Coctelería
    "bartender",
    "bartenders",
    "bartender para eventos",
    "bartenders para fiestas",
    "servicio de bartender",
    "bartender para bodas",
    "bartender para XV años",
    "mixología para eventos",
    "coctelería para eventos",
    "servicio de coctelería",
    "coctelería para bodas",
    "coctelería para fiestas",
    // Productos Estrella
    "cantaritos para eventos",
    "cantaritos de tequila",
    "cantaritos el güero estilo",
    "vaso tequilitros 32 oz",
    "vaso reyma 32 eu eventos",
    "palomas de tequila",
    "vampiros con sangrita",
    "mojitos con tequila",
    "barra libre de cócteles",
    // Ciudades y Ubicaciones
    "barra móvil Colotlán",
    "barra móvil Jalisco",
    "barra móvil Zacatecas",
    "barra móvil Guadalajara",
    "bartender Jalisco",
    "bartender Zacatecas",
    "coctelería Colotlán",
    "Destiladora del Norte",
    "tequila Colotlán",
  ],
  authors: [{ name: "Tequilitros Eventos", url: `${siteUrl}/tequilitros` }],
  creator: "Destiladora del Norte",
  publisher: "Tequilitros Eventos",
  category: "Servicio de Barra Móvil, Bartender y Coctelería para Eventos",
  classification: "Event Services, Mobile Bar, Bartending, Cocktail Catering",
  alternates: {
    canonical: "/tequilitros",
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/tequilitros",
    siteName: "Tequilitros Eventos",
    title: "Tequilitros Eventos | Barra Móvil, Bartender y Coctelería para Eventos",
    description:
      "Servicio profesional de barra móvil, bartender y coctelería para bodas, XV años y fiestas. Cantaritos en vaso de 32 oz, palomas, vampiros y mixología en Jalisco y Zacatecas. ¡Cotiza tu fecha!",
    images: [
      {
        url: "/tequilitros/productos/cantarito.png",
        width: 1126,
        height: 1600,
        alt: "Barra Móvil Tequilitros Eventos - Cantarito con tequila blanco y escarchado Tajín",
      },
      {
        url: "/tequilitros/cantarito.jpg",
        width: 1200,
        height: 1600,
        alt: "Cantarito Tequilitros Eventos frente a barrica de roble",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tequilitros Eventos | Barra Móvil y Bartender para Eventos",
    description:
      "Servicio de barra móvil, bartenders profesionales y cócteles para bodas, fiestas y aniversarios en Jalisco y Zacatecas.",
    images: ["/tequilitros/productos/cantarito.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "geo.region": "MX-JAL",
    "geo.placename": "Colotlán, Jalisco",
    "geo.position": "22.1158;-103.2642",
    ICBM: "22.1158, -103.2642",
    rating: "General",
  },
};

export default function TequilitrosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
