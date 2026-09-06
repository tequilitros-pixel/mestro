import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const url = new URL(process.env.DATABASE_URL!);
    const [identity] = await prisma.$queryRaw<Array<{ database: string; schema: string }>>`
      SELECT current_database() AS database, current_schema() AS schema
    `;
    return NextResponse.json({ host: url.hostname, database: identity.database, schema: identity.schema }, { headers });
  } catch {
    return new NextResponse(null, { status: 503, headers });
  }
}
