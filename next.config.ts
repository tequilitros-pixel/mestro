import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/pos",
        destination: "/pospress",
        permanent: true,
      },
      {
        source: "/pos2/:path*",
        destination: "/pospress",
        permanent: true,
      },
      {
        source: "/workforce-v1/:path*",
        destination: "/workforce/:path*",
        permanent: true,
      },
      // La portada del portal Workforce fue reemplazada por el horario
      // operativo original. Conservamos las rutas específicas de checador,
      // disponibilidad y nómina mientras existan, pero un acceso histórico a
      // la portada ya no debe reabrir esa experiencia.
      {
        source: "/workforce",
        destination: "/administration/schedule",
        permanent: false,
      },
      {
        source: "/administration/workforce/:path*",
        destination: "/administration/schedule",
        permanent: false,
      },
      {
        source: "/administration/workforce-v1/:path*",
        destination: "/administration/schedule",
        permanent: false,
      },
    ];
  },
  // El adaptador y el pool dependen de clases CommonJS de node-postgres.
  // Se cargan con require nativo de Node para evitar que Turbopack altere
  // sus constructores al incluirlos en el bundle de componentes servidor.
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "pg-pool"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Evita que el sitio se cargue dentro de un <iframe> en otro
          // dominio (protección contra clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // El navegador no debe "adivinar" el tipo de contenido de las
          // respuestas — reduce el riesgo de ataques por MIME sniffing.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No manda la URL completa como referrer a otros sitios.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Aísla ventanas abiertas por este origen para reducir filtraciones
          // entre contextos de navegación.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Evita que otros sitios reutilicen recursos privados de la app.
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          // Mantiene este origen en un proceso aislado del agente del navegador.
          { key: "Origin-Agent-Cluster", value: "?1" },
          // Evita consultas DNS automáticas que no fueron solicitadas por la app.
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // No permite políticas heredadas para contenido de Adobe/Microsoft.
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "form-action 'self'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline' https://unpkg.com",
              `script-src 'self' 'unsafe-inline' https://unpkg.com${isDevelopment ? " 'unsafe-eval'" : ""}`,
              "connect-src 'self' https:",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
          // Fuerza HTTPS en el navegador para este dominio durante 2 años.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
      // El navegador debe volver a validar el worker en cada apertura para
      // que una PWA instalada no quede atendiendo recursos de una versión
      // anterior después de una publicación.
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
