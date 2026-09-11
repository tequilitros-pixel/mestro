import { NextResponse } from "next/server";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { transferCash } from "@/lib/cash-cuts/safeEnvelopes";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentCommandActor();
    const body = await request.json() as Record<string, unknown>;
    const endpoint = (value: unknown) => {
      const item = value as Record<string, unknown>;
      if ((item?.type !== "CASH_SESSION" && item?.type !== "ENVELOPE") || typeof item.id !== "string") throw new Error("endpoint");
      return { type: item.type, id: item.id } as const;
    };
    const result = await transferCash({ operationId: String(body.operationId ?? ""), source: endpoint(body.source), destination: endpoint(body.destination), amount: String(body.amount ?? ""), reason: String(body.reason ?? ""), actor });
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) { return pos2ErrorResponse(error); }
}
