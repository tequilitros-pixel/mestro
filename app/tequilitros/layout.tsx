import type { Metadata, Viewport } from "next";

const siteUrl = "https://www.destiladoradelnorte.com";

export const viewport: Viewport = {
  themeColor: "#0A0E12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bartender para Eventos, Barras Móviles y Mixología | Tequilitros Eventos",
    template: "%s | Tequilitros Eventos",
  },
  description:
    "Servicio profesional de bartender para eventos, barras móviles, mixología y cantaritos de tequila para bodas, XV años y fiestas. Paquetes para eventos desde $90/persona. Jalisco y Zacatecas. ¡Cotiza tu fecha!",
  keywords: [
    // Búsqueda de Bartender y Servicio
    "bartender para eventos",
    "bartenders para eventos",
    "bartender para fiestas",
    "bartenders para fiestas",
    "bartender para bodas",
    "bartender para XV años",
    "servicio de bartender",
    "contratar bartender",
    "bartender a domicilio",
    // Búsqueda de Barras Móviles
    "barras móviles",
    "barra móvil",
    "barras móviles para eventos",
    "barra móvil para eventos",
    "barras móviles para bodas",
    "barra móvil para bodas",
    "barras móviles para fiestas",
    "renta de barra móvil",
    "servicio de barra móvil",
    "barra de tequila",
    "barra de bebidas para eventos",
    // Búsqueda de Mixología y Coctelería
    "mixología de eventos",
    "mixología para eventos",
    "coctelería para eventos",
    "servicio de mixología",
    "coctelería para bodas",
    "coctelería para fiestas",
    "barra libre de cócteles",
    // Búsqueda de Paquetes
    "paquetes para eventos",
    "paquetes de bartender",
    "paquetes de barra móvil",
    "paquetes de bebidas para bodas",
    "costo de barra libre para fiestas",
    // Marca y Concepto Estrella
    "tequilitros eventos",
    "tequilitros para eventos",
    "tequilitros",
    "tequilitros oficial",
    "cantaritos para eventos",
    "cantaritos de tequila",
    "cantaritos para bodas",
    "vaso tequilitros 32 oz",
    "cantaritos el güero estilo",
    // Ciudades y Ubicaciones de Cobertura
    "bartender Jalisco",
    "bartender Zacatecas",
    "barra móvil Jalisco",
    "barra móvil Zacatecas",
    "barra móvil Guadalajara",
    "barra móvil Zapopan",
    "barra móvil Colotlán",
    "barra móvil Jerez",
    "barra móvil Tlaltenango",
    "barra móvil Fresnillo",
    "Destiladora del Norte",
  ],
  authors: [{ name: "Tequilitros Eventos", url: `${siteUrl}/tequilitros` }],
  creator: "Destiladora del Norte",
  publisher: "Tequilitros Eventos",
  category: "Servicio de Bartender para Eventos, Barras Móviles y Mixología",
  classification: "Event Bartender, Mobile Bar Catering, Cocktail Services, Party Beverage Packages",
  alternates: {
    canonical: "/tequilitros",
  },
  appleWebApp: {
    title: "Tequilitros Eventos",
    statusBarStyle: "black-translucent",
    capable: true,
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/tequilitros",
    siteName: "Tequilitros Eventos",
    title: "Bartender para Eventos, Barras Móviles y Mixología | Tequilitros Eventos",
    description:
      "Servicio profesional de bartender para eventos, barras móviles, mixología y cantaritos de 32 oz para bodas, XV años y fiestas. Paquetes desde $90/persona en Jalisco y Zacatecas.",
    images: [
      {
        url: "/tequilitros/productos/cantarito.png",
        width: 1126,
        height: 1600,
        alt: "Bartender para Eventos y Barra Móvil Tequilitros - Cantarito 32 oz",
      },
      {
        url: "/tequilitros/cantarito.jpg",
        width: 1200,
        height: 1600,
        alt: "Barra Móvil de Madera Tequilitros Eventos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bartender para Eventos y Barras Móviles | Tequilitros Eventos",
    description:
      "Servicio de bartender para eventos, barras móviles y paquetes de mixología desde $90 MXN/persona. Bodas, XV años y fiestas en Jalisco y Zacatecas.",
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
    "geo.placename": "Colotlán, Jalisco, México",
    "geo.position": "22.1158;-103.2642",
    ICBM: "22.1158, -103.2642",
    rating: "General",
    "apple-mobile-web-app-title": "Tequilitros Eventos",
  },
};

export default function TequilitrosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
