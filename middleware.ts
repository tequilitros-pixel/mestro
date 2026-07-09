import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

const OPERATOR_ALLOWED_PATHS = [
  "/cooking",
  "/milling",
  "/fermentation",
  "/distillation",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const hasSession = request.cookies.has("maestro_user");

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && !isPublic) {
    const role = request.cookies.get("maestro_role")?.value;

    const isAllowedForOperator = OPERATOR_ALLOWED_PATHS.some((path) =>
      pathname.startsWith(path)
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
    "/((?!_next/static|_next/image|favicon.ico|login).*)",
  ],
};
