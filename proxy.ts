import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/*
 * El proxy NO debe consultar Prisma/Postgres. Aunque Next 16 documenta
 * que proxy.ts corre en runtime de Node.js, en la práctica el bundling
 * de este archivo rompe @prisma/adapter-pg + pg ("this.Client is not
 * a constructor") — es un problema conocido y confirmado en varios
 * issues de Next.js/Prisma (ver docs de proxy.ts: "no es un buen
 * lugar para manejo de sesión"). La verificación de rol/actividad
 * contra la base de datos se hace en app/layout.tsx, que sí es un
 * Server Component normal y puede usar Prisma sin problema.
 */

const PUBLIC_PATHS = ["/login", "/q", "/forgot-password", "/reset-password"];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const isPublicPage = PUBLIC_PATHS.some((path) => matchesPath(pathname, path));

  if (isPublicPage) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const userId = request.cookies.get("maestro_user")?.value;

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // La verificación de rol/actividad contra la base de datos ocurre
  // en app/layout.tsx (ver comentario arriba). Aquí solo confirmamos
  // que exista la cookie de sesión y dejamos pasar la request.
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|api/).*)",
  ],
};
