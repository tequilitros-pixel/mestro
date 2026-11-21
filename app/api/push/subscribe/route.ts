import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cleanText, httpUrl, plainObject } from "@/lib/inputValidation";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const subscription = plainObject(await request.json().catch(() => null));
  const keys = plainObject(subscription?.keys);
  const endpoint = httpUrl(subscription?.endpoint);
  const p256dh = cleanText(keys?.p256dh, { min: 16, max: 512 });
  const auth = cleanText(keys?.auth, { min: 8, max: 256 });
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      p256dh,
      auth,
      userId: user.id,
    },
    create: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
    },
  });

  return NextResponse.json({ success: true });
}
