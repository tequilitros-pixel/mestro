import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/workforce-v1/:path*",
        destination: "/workforce/:path*",
        permanent: true,
      },
      {
        source: "/administration/workforce-v1/:path*",
        destination: "/administration/workforce/:path*",
        permanent: true,
      },
      {
        source: "/timeclock",
        destination: "/workforce/clock",
        permanent: true,
      },
      {
        source: "/timeclock/calendar",
        destination: "/workforce",
        permanent: true,
      },
      {
        source: "/timeclock/availability",
        destination: "/workforce/availability",
        permanent: true,
      },
      {
        source: "/timeclock/hours",
        destination: "/workforce/timesheet",
        permanent: true,
      },
      {
        source: "/timeclock/history",
        destination: "/workforce/timesheet",
        permanent: true,
      },
      {
        source: "/timeclock/requests",
        destination: "/workforce/clock",
        permanent: true,
      },
      {
        source: "/timeclock/payroll",
        destination: "/workforce/payroll",
        permanent: true,
      },
      {
        source: "/timeclock/kiosk",
        destination: "/workforce/kiosk",
        permanent: true,
      },
      {
        source: "/timeclock/geofences",
        destination: "/administration/workforce/settings",
        permanent: true,
      },
      {
        source: "/administration/schedule",
        destination: "/administration/workforce/schedule",
        permanent: true,
      },
      {
        source: "/administration/personnel/timeclock",
        destination: "/administration/workforce/clock-corrections",
        permanent: true,
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
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline'",
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
    ];
  },
};

export default nextConfig;
