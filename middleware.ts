import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

const PUBLIC_API_PATHS = [
  "/api/push/check-overdue",
];

const OPERATOR_ALLOWED_PATHS = [
  "/cooking",
  "/milling",
  "/fermentation",
  "/distillation",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPage = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const isPublicApi = PUBLIC_API_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  /*
   * Esta ruta no necesita la cookie de sesión porque se protege
   * dentro de route.ts mediante CRON_SECRET.
   */
  if (isPublicApi) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("maestro_user");

  if (!hasSession && !isPublicPage) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && !isPublicPage) {
    const role = request.cookies.get("maestro_role")?.value;

    const isAllowedForOperator = OPERATOR_ALLOWED_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );

    if (role === "OPERATOR" && !isAllowedForOperator) {
      const cookingUrl = new URL("/cooking", request.url);
      return NextResponse.redirect(cookingUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|manifest.json|sw.js|icon-192.png|icon-512.png).*)",
  ],
};