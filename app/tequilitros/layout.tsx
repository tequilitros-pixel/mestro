import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maestro-destiladora.space";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tequilitros | Barra Móvil y Mixología para Eventos",
    template: "%s | Tequilitros para Eventos",
  },
  description:
    "Barra móvil de mixología y cantaritos de 1 litro para bodas, XV años y celebraciones en Colotlán, Jalisco, Zacatecas y la región. Tequila y licores artesanales de Destiladora del Norte.",
  keywords: [
    "Tequilitros",
    "Tequilitros para Eventos",
    "Barra móvil",
    "Barra móvil Colotlán",
    "Barra móvil Jalisco",
    "Barra móvil Zacatecas",
    "Bartenders para eventos",
    "Mixología para eventos",
    "Cantaritos para eventos",
    "Bebidas para bodas",
    "Coctelería para fiestas",
    "Cantaritos de 1 litro",
    "Destiladora del Norte",
    "Tequila artesanal Colotlán",
  ],
  alternates: { canonical: "/tequilitros" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/tequilitros",
    siteName: "Tequilitros para Eventos",
    title: "Tequilitros | Barra Móvil y Mixología para Eventos",
    description:
      "Llevamos el sabor y carácter de nuestra destilería a tu celebración. Cantaritos de 1 litro, mixología de autor y barra móvil en Jalisco y Zacatecas.",
    images: [
      {
        url: "/tequilitros/cantarito.jpg",
        width: 1200,
        height: 1600,
        alt: "Cantarito Tequilitros de 1 litro frente a una barrica de roble",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tequilitros | Barra Móvil para Eventos",
    description: "Cantaritos de 1 litro y mixología con tequila de la casa para tu fiesta.",
    images: ["/tequilitros/cantarito.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function TequilitrosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
