import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();

  cookieStore.delete("maestro_user");
  cookieStore.delete("maestro_role");

  const url = new URL("/login?expired=1", request.url);
  return NextResponse.redirect(url);
}
