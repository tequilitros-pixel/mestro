import type { CapacitorConfig } from "@capacitor/cli";

/*
 * Maestro es una app Next.js con render en servidor, acciones de
 * servidor y sesión por cookie — no un sitio estático. Por eso
 * Capacitor no empaqueta los archivos localmente: apunta el WebView
 * directo al sitio ya desplegado en Vercel (server.url), igual que
 * un navegador normal, para que login, Prisma y todo lo demás
 * sigan funcionando sin reescribir nada.
 */
const config: CapacitorConfig = {
  appId: "com.destiladoradelnorte",
  appName: "Maestro",
  webDir: "public",
  server: {
    url: "https://maestro-destiladora.space",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
