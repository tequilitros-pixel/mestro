import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    }
    const url = new URL(process.env.DATABASE_URL!);
    const [identity] = await prisma.$queryRaw<Array<{ database: string; schema: string }>>`
      SELECT current_database() AS database, current_schema() AS schema
    `;
    return NextResponse.json({ host: url.hostname, database: identity.database, schema: identity.schema }, { headers });
  } catch {
    return NextResponse.json({ error: "Runtime identity unavailable" }, { status: 503, headers });
  }
}
