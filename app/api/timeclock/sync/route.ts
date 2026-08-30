import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "El checador anterior fue retirado. Abre Workforce para registrar una marcación nueva.",
    },
    { status: 410 },
  );
}
