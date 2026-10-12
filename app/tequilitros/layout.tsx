import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maestro-destiladora.space";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tequilitros | Barra Móvil y Mixología para Eventos",
    template: "%s | Tequilitros para Eventos",
  },
  description:
    "Bebidas y propuesta de barra móvil para eventos desde Colotlán, Jalisco. Consulta la carta, disponibilidad y cobertura por WhatsApp.",
  keywords: [
    "Tequilitros",
    "Tequilitros para Eventos",
    "Barra móvil",
    "Barra móvil Colotlán",
    "Barra móvil Jalisco",
    "Mixología para eventos",
    "Cantaritos para eventos",
    "Bebidas para bodas",
    "Coctelería para fiestas",
    "Destiladora del Norte",
    "Tequila Colotlán",
  ],
  alternates: { canonical: "/tequilitros" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/tequilitros",
    siteName: "Tequilitros para Eventos",
    title: "Tequilitros | Barra Móvil y Mixología para Eventos",
    description:
      "Consulta la carta de bebidas y la propuesta de barra móvil para tu celebración. Disponibilidad, localidad y alcance se confirman antes de contratar.",
    images: [
      {
        url: "/tequilitros/cantarito.jpg",
        width: 1200,
        height: 1600,
        alt: "Cantarito Tequilitros frente a una barrica de roble",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tequilitros | Barra Móvil para Eventos",
    description: "Carta de bebidas y propuesta de barra móvil para tu fiesta.",
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
