"use server";

import { revalidatePath } from "next/cache";
import * as webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canRoleReceiveNotification } from "@/lib/notifications/access";

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
  metadata?: any;
  createdAt: string;
};

export type ActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

/**
 * Obtiene las notificaciones del usuario autenticado.
 */
export async function getMyNotificationsAction(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<ActionResult<NotificationItem[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
    const unreadOnly = Boolean(options?.unreadOnly);

    const delegate = (prisma as any).notification;
    if (delegate?.findMany) {
      const records = await delegate.findMany({
        where: {
          userId: user.id,
          ...(unreadOnly ? { read: false } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return {
        success: true,
        data: records.filter((r: any) => canRoleReceiveNotification(user.role, r.category, r.metadata)).map((r: any) => ({
          id: r.id,
          userId: r.userId,
          title: r.title,
          body: r.body,
          category: r.category as NotificationCategory,
          priority: r.priority as NotificationPriority,
          href: r.href,
          read: r.read,
          readAt: r.readAt ? r.readAt.toISOString() : null,
          metadata: r.metadata,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }

    // Fallback defensivo a SQL crudo si el cliente Prisma está en transición de compilación
    const rows = unreadOnly
      ? await prisma.$queryRaw<any[]>`
          SELECT id, "userId", title, body, category, priority, href, read, "readAt", metadata, "createdAt"
          FROM "Notification"
          WHERE "userId" = ${user.id} AND read = false
          ORDER BY "createdAt" DESC
          LIMIT ${limit}
        `
      : await prisma.$queryRaw<any[]>`
          SELECT id, "userId", title, body, category, priority, href, read, "readAt", metadata, "createdAt"
          FROM "Notification"
          WHERE "userId" = ${user.id}
          ORDER BY "createdAt" DESC
          LIMIT ${limit}
        `;

    return {
      success: true,
      data: (rows ?? []).filter((r) => canRoleReceiveNotification(user.role, r.category, r.metadata)).map((r) => ({
        id: r.id,
        userId: r.userId,
        title: r.title,
        body: r.body,
        category: r.category as NotificationCategory,
        priority: r.priority as NotificationPriority,
        href: r.href,
        read: Boolean(r.read),
        readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
        metadata: r.metadata,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
    };
  } catch (error: any) {
    console.error("[getMyNotificationsAction] Error:", error);
    return { success: false, error: error?.message ?? "Error al obtener notificaciones" };
  }
}

/**
 * Obtiene el total de notificaciones no leídas del usuario autenticado.
 */
export async function getUnreadNotificationsCountAction(): Promise<number> {
  try {
    const user = await getCurrentUser();
    if (!user) return 0;

    const delegate = (prisma as any).notification;
    if (delegate?.count && user.role !== "OPERATOR" && user.role !== "CONSULTA") {
      return await delegate.count({
        where: { userId: user.id, read: false },
      });
    }

    const rows = await prisma.$queryRaw<Array<{ category: NotificationCategory; metadata: unknown }>>`
      SELECT category, metadata
      FROM "Notification"
      WHERE "userId" = ${user.id} AND read = false
    `;

    return rows.filter((row) => canRoleReceiveNotification(user.role, row.category, row.metadata)).length;
  } catch (error) {
    console.error("[getUnreadNotificationsCountAction] Error:", error);
    return 0;
  }
}

/**
 * Marca una notificación específica como leída.
 */
export async function markNotificationAsReadAction(
  notificationId: string
): Promise<ActionResult<boolean>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado" };

    const delegate = (prisma as any).notification;
    if (delegate?.updateMany) {
      await delegate.updateMany({
        where: { id: notificationId, userId: user.id },
        data: { read: true, readAt: new Date() },
      });
    } else {
      await prisma.$executeRaw`
        UPDATE "Notification"
        SET read = true, "readAt" = NOW()
        WHERE id = ${notificationId} AND "userId" = ${user.id}
      `;
    }

    revalidatePath("/");
    return { success: true, data: true };
  } catch (error: any) {
    console.error("[markNotificationAsReadAction] Error:", error);
    return { success: false, error: error?.message ?? "Error al marcar como leída" };
  }
}

/**
 * Marca todas las notificaciones pendientes del usuario como leídas.
 */
export async function markAllNotificationsAsReadAction(): Promise<ActionResult<boolean>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado" };

    const delegate = (prisma as any).notification;
    if (delegate?.updateMany) {
      await delegate.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true, readAt: new Date() },
      });
    } else {
      await prisma.$executeRaw`
        UPDATE "Notification"
        SET read = true, "readAt" = NOW()
        WHERE "userId" = ${user.id} AND read = false
      `;
    }

    revalidatePath("/");
    return { success: true, data: true };
  } catch (error: any) {
    console.error("[markAllNotificationsAsReadAction] Error:", error);
    return { success: false, error: error?.message ?? "Error al marcar todas como leídas" };
  }
}

/**
 * Función interna utilitaria para despachar una notificación en base de datos.
 */
export async function createNotification(data: {
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  href?: string;
  metadata?: any;
}): Promise<NotificationItem> {
  const recipient = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { active: true, role: true },
  });
  if (!recipient?.active || !canRoleReceiveNotification(recipient.role, data.category, data.metadata)) {
    throw new Error("NOTIFICATION_RECIPIENT_NOT_ALLOWED");
  }

  const priority = data.priority ?? "NORMAL";
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date();

  const delegate = (prisma as any).notification;
  if (delegate?.create) {
    const record = await delegate.create({
      data: {
        id,
        userId: data.userId,
        title: data.title,
        body: data.body,
        category: data.category,
        priority,
        href: data.href ?? null,
        metadata: data.metadata ?? null,
      },
    });

    return {
      id: record.id,
      userId: record.userId,
      title: record.title,
      body: record.body,
      category: record.category as NotificationCategory,
      priority: record.priority as NotificationPriority,
      href: record.href,
      read: record.read,
      readAt: record.readAt ? record.readAt.toISOString() : null,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
    };
  }

  await prisma.$executeRaw`
    INSERT INTO "Notification" ("id", "userId", "title", "body", "category", "priority", "href", "metadata", "read", "createdAt")
    VALUES (
      ${id},
      ${data.userId},
      ${data.title},
      ${data.body},
      ${data.category}::"NotificationCategory",
      ${priority}::"NotificationPriority",
      ${data.href ?? null},
      ${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb,
      false,
      ${now}
    )
  `;

  return {
    id,
    userId: data.userId,
    title: data.title,
    body: data.body,
    category: data.category,
    priority,
    href: data.href ?? null,
    read: false,
    readAt: null,
    metadata: data.metadata,
    createdAt: now.toISOString(),
  };
}

/**
 * Despacha notificación a múltiples usuarios (ej. a todos los administradores o encargados).
 */
export async function createNotificationsForUsers(
  userIds: string[],
  data: {
    title: string;
    body: string;
    category: NotificationCategory;
    priority?: NotificationPriority;
    href?: string;
    metadata?: any;
  }
) {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  const recipients = await prisma.user.findMany({
    where: { id: { in: uniqueIds }, active: true },
    select: { id: true, role: true },
  });
  return Promise.all(
    recipients
      .filter((recipient) => canRoleReceiveNotification(recipient.role, data.category, data.metadata))
      .map((recipient) =>
      createNotification({
        userId: recipient.id,
        title: data.title,
        body: data.body,
        category: data.category,
        priority: data.priority,
        href: data.href,
        metadata: data.metadata,
      })
    )
  );
}

/**
 * Envía una notificación de prueba al usuario en sesión (In-App y Push si está suscrito).
 */
export async function sendTestNotificationAction(): Promise<ActionResult<{ pushedCount: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado" };

    // 1. Notificación In-App en base de datos
    await createNotification({
      userId: user.id,
      title: "🔔 Notificación de prueba",
      body: "Tu dispositivo y tu cuenta de Maestro están listos para recibir avisos en tiempo real.",
      category: "SYSTEM",
      priority: "NORMAL",
      href: "/profile",
      metadata: { test: true },
    });

    // 2. Notificación Web Push si el usuario tiene dispositivos registrados
    let pushedCount = 0;
    try {
      const subject = process.env.VAPID_SUBJECT;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;

      if (subject && publicKey && privateKey) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: user.id },
        });

        const payload = JSON.stringify({
          title: "🔔 Notificación de prueba",
          body: "Tu dispositivo está configurado correctamente en Maestro.",
          url: "/profile",
        });

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );
            pushedCount++;
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
      }
    } catch (pushErr) {
      console.error("[sendTestNotificationAction] Error enviando web push:", pushErr);
    }

    revalidatePath("/");
    return { success: true, data: { pushedCount } };
  } catch (error: any) {
    console.error("[sendTestNotificationAction] Error:", error);
    return { success: false, error: error?.message ?? "Error al enviar prueba" };
  }
}
