import { NextResponse } from "next/server";
import { enrollTerminal } from "@/lib/pos2/terminals";
import { pos2ErrorResponse } from "@/lib/pos2/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.enrollmentToken !== "string" || typeof body.deviceIdentifier !== "string" || !body.deviceIdentifier.trim()) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Datos de enrolamiento inválidos." } }, { status: 422 });
    }
    return NextResponse.json(await enrollTerminal({ enrollmentToken: body.enrollmentToken, deviceIdentifier: body.deviceIdentifier }), { status: 201 });
  } catch (error) { return pos2ErrorResponse(error); }
}
