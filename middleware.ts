import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Requiere runtime de Node (no Edge) porque Prisma usa el driver
// nativo de pg, que no corre en el runtime Edge.
export const runtime = "nodejs";

const PUBLIC_PATHS = ["/login", "/q", "/forgot-password", "/reset-password"];

const OPERATOR_ALLOWED_PATHS = [
  "/cooking",
  "/milling",
  "/fermentation",
  "/distillation",
];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export async function middleware(request: NextRequest) {
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

  /*
   * El rol se verifica contra la base de datos en cada request en
   * lugar de confiar en la cookie "maestro_role": esa cookie la
   * puede modificar libremente quien la posea (es texto plano sin
   * firmar), así que usarla para decidir acceso permitiría que un
   * OPERATOR se autoasignara otro rol y se saltara la restricción
   * de abajo. Esta consulta es la única fuente confiable del rol.
   */
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, active: true },
  });

  if (!user || !user.active) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("maestro_user");
    response.cookies.delete("maestro_role");
    return response;
  }

  const isAllowedForOperator = OPERATOR_ALLOWED_PATHS.some((path) =>
    matchesPath(pathname, path),
  );

  if (user.role === "OPERATOR" && !isAllowedForOperator) {
    return NextResponse.redirect(new URL("/cooking", request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|api/).*)",
  ],
};
