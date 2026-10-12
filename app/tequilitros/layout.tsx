import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maestro-destiladora.space";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tequilitros | Barra móvil y bebidas para eventos",
    template: "%s | Tequilitros",
  },
  description:
    "Tequilitros lleva bebidas, licores y barra móvil a eventos en Colotlán, el norte de Jalisco, Zacatecas y localidades cercanas. Conoce el catálogo y solicita una cotización.",
  keywords: [
    "Tequilitros",
    "barra móvil para eventos",
    "bebidas para eventos",
    "tequila de Colotlán",
    "licores de Jalisco",
    "barra móvil Jalisco",
    "barra móvil Zacatecas",
    "Destiladora del Norte",
  ],
  alternates: { canonical: "/tequilitros" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/tequilitros",
    siteName: "Tequilitros",
    title: "Tequilitros | Barra móvil y bebidas para eventos",
    description:
      "Bebidas con identidad y barra móvil para celebraciones en Jalisco, Zacatecas y la región.",
    images: [{ url: "/tequilitros/cantarito.jpg", width: 1200, height: 1600, alt: "Cantarito Tequilitros frente a una barrica" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tequilitros | Barra móvil para eventos",
    description: "Bebidas con identidad para tu celebración.",
    images: ["/tequilitros/cantarito.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function TequilitrosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
