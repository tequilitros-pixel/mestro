import { NextResponse } from "next/server";
import * as webpush from "web-push";

import { prisma, rawPrisma } from "@/lib/prisma";
import { withDatabaseActor } from "@/lib/database-context";
import {
  createNotificationsForUsers,
  type NotificationCategory,
  type NotificationPriority,
} from "@/app/actions/notifications";
import {
  checkStockBajo,
  checkLicorCaducidad,
  checkReconteoPendiente,
  checkCorteDiferencia,
  checkProcesoAtrasado,
  type NotificationCheckResult,
} from "@/lib/notifications/checks";

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
    throw new Error("VAPID_SUBJECT debe comenzar con mailto: o https://");
  }

  if (!publicKey) {
    throw new Error("Falta la variable NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  }

  if (!privateKey) {
    throw new Error("Falta la variable VAPID_PRIVATE_KEY");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function runCheck(
  triggerType: string,
  thresholdConfig: unknown,
  lastCheckedAt: Date | null,
): Promise<NotificationCheckResult> {
  const config = (thresholdConfig ?? {}) as {
    daysBeforeExpiration?: number;
    minDifference?: number;
  };

  switch (triggerType) {
    case "STOCK_BAJO":
      return checkStockBajo();
    case "LICOR_CADUCIDAD":
      return checkLicorCaducidad(config.daysBeforeExpiration ?? 7);
    case "RECONTEO_PENDIENTE":
      return checkReconteoPendiente();
    case "CORTE_DIFERENCIA":
      return checkCorteDiferencia(config.minDifference ?? 10, lastCheckedAt);
    case "PROCESO_ATRASADO":
      return checkProcesoAtrasado();
    default:
      return null;
  }
}

function getTriggerCategory(triggerType: string): NotificationCategory {
  switch (triggerType) {
    case "STOCK_BAJO":
    case "RECONTEO_PENDIENTE":
      return "INVENTORY";
    case "LICOR_CADUCIDAD":
    case "PROCESO_ATRASADO":
      return "PRODUCTION";
    case "CORTE_DIFERENCIA":
      return "POS";
    default:
      return "SYSTEM";
  }
}

function getTriggerPriority(triggerType: string): NotificationPriority {
  switch (triggerType) {
    case "CORTE_DIFERENCIA":
    case "PROCESO_ATRASADO":
      return "URGENT";
    case "STOCK_BAJO":
    case "LICOR_CADUCIDAD":
      return "HIGH";
    default:
      return "NORMAL";
  }
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[PUSH CHECK] Falta la variable CRON_SECRET");
      return NextResponse.json(
        { error: "Configuración incompleta del servidor" },
        { status: 500 },
      );
    }

    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // El cron no tiene cookie de usuario. Al habilitar RLS para CashCut,
    // necesita un contexto administrativo explícito después de validar el
    // secreto del cron; nunca se toma identidad desde la petición.
    const serviceAdmin = await rawPrisma.user.findFirst({
      where: { active: true, role: "ADMIN" },
      select: { id: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    if (!serviceAdmin) {
      return NextResponse.json(
        { error: "No hay un administrador activo para el servicio" },
        { status: 503 },
      );
    }

    configureWebPush();

    const now = new Date();

    const rules = await prisma.notificationRule.findMany({
      where: { active: true },
    });

    const dueRules = rules.filter((rule) => {
      if (!rule.lastCheckedAt) return true;
      const minutesSinceCheck =
        (now.getTime() - rule.lastCheckedAt.getTime()) / (1000 * 60);
      return minutesSinceCheck >= rule.checkFrequencyMinutes;
    });

    let evaluated = 0;
    let triggered = 0;
    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const rule of dueRules) {
      evaluated += 1;

      const result = await withDatabaseActor(serviceAdmin, () =>
        runCheck(rule.triggerType, rule.thresholdConfig, rule.lastCheckedAt),
      );

      if (!result) {
        await prisma.notificationRule.update({
          where: { id: rule.id },
          data: { lastCheckedAt: now },
        });
        continue;
      }

      triggered += 1;

      // Disparo In-App para la campanita del header
      try {
        const recipientUsers = await prisma.user.findMany({
          where: { role: { in: rule.recipientRoles }, active: true },
          select: { id: true },
        });
        if (recipientUsers.length > 0) {
          await createNotificationsForUsers(
            recipientUsers.map((u) => u.id),
            {
              title: result.title,
              body: result.body,
              category: getTriggerCategory(rule.triggerType),
              priority: getTriggerPriority(rule.triggerType),
              href: result.url,
              metadata: { ruleId: rule.id, triggerType: rule.triggerType },
            }
          );
        }
      } catch (inAppErr) {
        console.error("[PUSH CHECK] Error creando notificación In-App:", inAppErr);
      }

      const subscriptions = await prisma.pushSubscription.findMany({
        where: { user: { role: { in: rule.recipientRoles }, active: true } },
      });

      const payload = JSON.stringify({
        title: result.title,
        body: result.body,
        url: result.url,
      });

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
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
            ruleId: rule.id,
            subscriptionId: subscription.id,
            statusCode: pushError.statusCode,
            message: pushError.message,
            body: pushError.body,
          });

          if (pushError.statusCode === 404 || pushError.statusCode === 410) {
            await prisma.pushSubscription.delete({
              where: { id: subscription.id },
            });

            removed += 1;
          }
        }
      }

      await prisma.notificationRule.update({
        where: { id: rule.id },
        data: { lastCheckedAt: now, lastSentAt: now },
      });
    }

    return NextResponse.json({
      success: true,
      rulesEvaluated: evaluated,
      rulesTriggered: triggered,
      sent,
      failed,
      removed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";

    console.error("[PUSH CHECK ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        error: "No fue posible revisar las notificaciones",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}
