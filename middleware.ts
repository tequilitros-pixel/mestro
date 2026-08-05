import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const isPublicPage = PUBLIC_PATHS.some((path) => matchesPath(pathname, path));

  if (isPublicPage) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hasSession = request.cookies.has("maestro_user");

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = request.cookies.get("maestro_role")?.value;

  const isAllowedForOperator = OPERATOR_ALLOWED_PATHS.some((path) =>
    matchesPath(pathname, path),
  );

  if (role === "OPERATOR" && !isAllowedForOperator) {
    return NextResponse.redirect(new URL("/cooking", request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|api/).*)",
  ],
};
