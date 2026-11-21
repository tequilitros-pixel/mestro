import type { Metadata } from "next";
import StoreClient from "./StoreClient";

const storeUrl = "https://www.destiladoradelnorte.com/TequilaElColotlense";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.destiladoradelnorte.com"),
  title: "Tequila El Colotlense | Tienda Oficial y Punto de Venta · Destiladora del Norte",
  description:
    "Sitio oficial de venta de Tequila El Colotlense (Blanco, Reposado, Añejo, Cristalino) y licores artesanales. Venta directa de fábrica desde Colotlán, Jalisco. Envíos seguros a todo México con paquetería certificada.",
  keywords: [
    "Tequila El Colotlense",
    "Destiladora del Norte",
    "Comprar tequila online",
    "Tequila artesanal Colotlán",
    "Tequila reposado 100% agave",
    "Licor artesanal de zarzamora",
    "Venta de tequila por mayoreo",
    "Envío nacional de tequila",
  ],
  alternates: {
    canonical: storeUrl,
  },
  openGraph: {
    title: "Tequila El Colotlense | Tienda Oficial · Destiladora del Norte",
    description:
      "Venta directa de fábrica de Tequilas 100% de Agave y Licores Artesanales. Envíos protegidos a toda la República Mexicana.",
    url: storeUrl,
    siteName: "Destiladora del Norte · Tequila El Colotlense",
    images: [
      {
        url: "/tienda/tequila-reposado.jpg",
        width: 1200,
        height: 630,
        alt: "Tequila El Colotlense Reposado - Destiladora del Norte",
      },
    ],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tequila El Colotlense | Tienda Oficial y Punto de Venta",
    description:
      "Venta directa de fábrica desde Colotlán, Jalisco. Envíos a todo México con embalaje de seguridad.",
    images: ["/tienda/tequila-reposado.jpg"],
  },
};

export default function TiendaPage() {
  return <StoreClient />;
}
