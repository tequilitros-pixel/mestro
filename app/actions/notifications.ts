"use server";

import { revalidatePath } from "next/cache";
import * as webpush from "web-push";
import type { Notification, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type NotificationCategory =
  | "POS"
  | "TIMECLOCK"
  | "PAYROLL"
  | "INVENTORY"
  | "PRODUCTION"
  | "SYSTEM";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  href: string | null;
  read: boolean;
  readAt: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

export type ActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toNotificationItem(record: Notification): NotificationItem {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    body: record.body,
    category: record.category,
    priority: record.priority,
    href: record.href,
    read: record.read,
    readAt: record.readAt?.toISOString() ?? null,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
  };
}

function isGonePushSubscription(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    ((error as { statusCode?: unknown }).statusCode === 404 ||
      (error as { statusCode?: unknown }).statusCode === 410)
  );
}

/** Obtiene las notificaciones del usuario autenticado. */
export async function getMyNotificationsAction(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<ActionResult<NotificationItem[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado" };

    const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
    const records = await prisma.notification.findMany({
      where: { userId: user.id, ...(options?.unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { success: true, data: records.map(toNotificationItem) };
  } catch (error) {
    console.error("[getMyNotificationsAction] Error:", error);
    return { success: false, error: errorMessage(error, "Error al obtener notificaciones") };
  }
}

/** Obtiene el total de notificaciones no leídas del usuario autenticado. */
export async function getUnreadNotificationsCountAction(): Promise<number> {
  try {
    const user = await getCurrentUser();
    if (!user) return 0;
    return await prisma.notification.count({ where: { userId: user.id, read: false } });
  } catch (error) {
    console.error("[getUnreadNotificationsCountAction] Error:", error);
    return 0;
  }
}

/** Marca una notificación específica como leída. */
export async function markNotificationAsReadAction(notificationId: string): Promise<ActionResult<boolean>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado" };
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { read: true, readAt: new Date() },
    });
    revalidatePath("/");
    return { success: true, data: true };
  } catch (error) {
    console.error("[markNotificationAsReadAction] Error:", error);
    return { success: false, error: errorMessage(error, "Error al marcar como leída") };
  }
}

/** Marca todas las notificaciones pendientes del usuario como leídas. */
export async function markAllNotificationsAsReadAction(): Promise<ActionResult<boolean>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado" };
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    revalidatePath("/");
    return { success: true, data: true };
  } catch (error) {
    console.error("[markAllNotificationsAsReadAction] Error:", error);
    return { success: false, error: errorMessage(error, "Error al marcar todas como leídas") };
  }
}

/** Función interna para despachar una notificación en base de datos. */
export async function createNotification(data: {
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  href?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<NotificationItem> {
  const record = await prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      body: data.body,
      category: data.category,
      priority: data.priority ?? "NORMAL",
      href: data.href ?? null,
      metadata: data.metadata,
    },
  });
  return toNotificationItem(record);
}

/** Despacha una notificación a varios usuarios. */
export async function createNotificationsForUsers(
  userIds: string[],
  data: {
    title: string;
    body: string;
    category: NotificationCategory;
    priority?: NotificationPriority;
    href?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  return Promise.all(uniqueIds.map((userId) => createNotification({ userId, ...data })));
}

/** Envía una notificación de prueba al usuario en sesión. */
export async function sendTestNotificationAction(): Promise<ActionResult<{ pushedCount: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado" };

    await createNotification({
      userId: user.id,
      title: "🔔 Notificación de prueba",
      body: "Tu dispositivo y tu cuenta de Maestro están listos para recibir avisos en tiempo real.",
      category: "SYSTEM",
      priority: "NORMAL",
      href: "/profile",
      metadata: { test: true },
    });

    let pushedCount = 0;
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (subject && publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: user.id } });
      const payload = JSON.stringify({
        title: "🔔 Notificación de prueba",
        body: "Tu dispositivo está configurado correctamente en Maestro.",
        url: "/profile",
      });

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
          );
          pushedCount += 1;
        } catch (error) {
          if (isGonePushSubscription(error)) {
            await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
          } else {
            console.error("[sendTestNotificationAction] Error enviando web push:", error);
          }
        }
      }
    }

    revalidatePath("/");
    return { success: true, data: { pushedCount } };
  } catch (error) {
    console.error("[sendTestNotificationAction] Error:", error);
    return { success: false, error: errorMessage(error, "Error al enviar prueba") };
  }
}
