import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#090a0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Tequila El Colotlense | Tienda Oficial y Punto de Venta · Destiladora del Norte",
  description:
    "Punto de venta oficial de Tequila El Colotlense (100% Agave) y licores artesanales. Venta directa desde Colotlán, Jalisco con sistema de envíos protegidos a toda la República Mexicana.",
};

export default function TiendaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
