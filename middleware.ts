import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

const PUBLIC_API_PATHS = ["/api/push/check-overdue"];

const OPERATOR_ALLOWED_PATHS = [
  "/cooking",
  "/milling",
  "/fermentation",
  "/distillation",
];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPage = PUBLIC_PATHS.some((path) =>
    matchesPath(pathname, path)
  );

  const isPublicApi = PUBLIC_API_PATHS.some((path) =>
    matchesPath(pathname, path)
  );

  /*
   * Los cron jobs no usan la cookie maestro_user.
   * Esta ruta se protege en route.ts mediante CRON_SECRET.
   */
  if (isPublicApi) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("maestro_user");

  if (!hasSession && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && !isPublicPage) {
    const role = request.cookies.get("maestro_role")?.value;

    const isAllowedForOperator = OPERATOR_ALLOWED_PATHS.some((path) =>
      matchesPath(pathname, path)
    );

    if (role === "OPERATOR" && !isAllowedForOperator) {
      return NextResponse.redirect(new URL("/cooking", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|api/).*)",
  ],
};
