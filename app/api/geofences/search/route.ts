import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No tienes permiso" }, { status: 403 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Escribe una dirección para buscarla." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&language=es&q=${encodeURIComponent(query)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "MAESTRO geozonas/1.0 (maestro-destiladora.space)",
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "No se pudo buscar la dirección. Intenta de nuevo." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as unknown;
    const results = Array.isArray(data)
      ? data
          .filter(
            (item): item is { lat: string; lon: string; display_name: string } =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as Record<string, unknown>).lat === "string" &&
              typeof (item as Record<string, unknown>).lon === "string" &&
              typeof (item as Record<string, unknown>).display_name === "string",
          )
          .slice(0, 1)
      : [];

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el buscador de direcciones." },
      { status: 502 },
    );
  }
}
