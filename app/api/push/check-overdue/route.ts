import { NextResponse } from "next/server";
import * as webpush from "web-push";

import { prisma } from "@/lib/prisma";
import { getRecordingStatus } from "@/lib/brain/getRecordingStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configureWebPush() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject) {
    throw new Error("Falta la variable VAPID_SUBJECT");
  }

  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    throw new Error(
      "VAPID_SUBJECT debe comenzar con mailto: o https://"
    );
  }

  if (!publicKey) {
    throw new Error("Falta la variable NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  }

  if (!privateKey) {
    throw new Error("Falta la variable VAPID_PRIVATE_KEY");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error(
        "[PUSH CHECK OVERDUE] Falta la variable CRON_SECRET"
      );

      return NextResponse.json(
        { error: "Configuración incompleta del servidor" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    configureWebPush();

    const recordingStatus = await getRecordingStatus();

    const cooking = recordingStatus.cooking ?? [];
    const fermentation = recordingStatus.fermentation ?? [];

    const overdue = [...cooking, ...fermentation].filter(
      (record) => record.isOverdue
    );

    if (overdue.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        overdueCount: 0,
        subscriptionsCount: 0,
        message: "No hay procesos vencidos",
      });
    }

    const subscriptions =
      await prisma.pushSubscription.findMany();

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        overdueCount: overdue.length,
        subscriptionsCount: 0,
        message: "No existen dispositivos suscritos",
      });
    }

    const notificationPayload = JSON.stringify({
      title: "⏰ MAESTRO",
      body:
        overdue.length === 1
          ? `${overdue[0].label} lleva sin registro más de 1 hora.`
          : `${overdue.length} procesos llevan sin registro más de 1 hora.`,
      url: "/control-room",
    });

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          notificationPayload
        );

        sent += 1;
      } catch (error: unknown) {
        failed += 1;

        const pushError = error as {
          statusCode?: number;
          message?: string;
          body?: string;
        };

        console.error("[PUSH SEND ERROR]", {
          subscriptionId: subscription.id,
          statusCode: pushError.statusCode,
          message: pushError.message,
          body: pushError.body,
        });

        if (
          pushError.statusCode === 404 ||
          pushError.statusCode === 410
        ) {
          await prisma.pushSubscription.delete({
            where: { id: subscription.id },
          });

          removed += 1;
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      removed,
      overdueCount: overdue.length,
      subscriptionsCount: subscriptions.length,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error desconocido";

    console.error("[PUSH CHECK OVERDUE ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        error: "No fue posible revisar las notificaciones",
        detail:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      { status: 500 }
    );
  }
}