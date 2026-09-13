import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/session";

export async function GET(request: Request) {
  await revokeCurrentSession();

  const url = new URL("/login?expired=1", request.url);
  return NextResponse.redirect(url);
}
