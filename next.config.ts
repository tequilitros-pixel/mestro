import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
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
