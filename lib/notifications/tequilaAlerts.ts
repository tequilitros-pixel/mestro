import { prisma } from "@/lib/prisma";
import { createNotificationsForUsers } from "@/app/actions/notifications";

export type ProductionAlertInput = {
  title: string;
  body: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  href?: string;
  branchId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Despacha alertas operativas de producción a los responsables de planta
 * (ADMIN, GERENTE, ENCARGADO).
 */
export async function dispatchProductionAlert(input: ProductionAlertInput) {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "GERENTE", "ENCARGADO"] },
        active: true,
      },
      select: { id: true, role: true },
    });

    if (recipients.length === 0) return;

    await createNotificationsForUsers(
      recipients.map((r) => r.id),
      {
        title: input.title,
        body: input.body,
        category: "PRODUCTION",
        priority: input.priority ?? "NORMAL",
        href: input.href,
        metadata: {
          ...input.metadata,
          ...(input.branchId ? { branchId: input.branchId } : {}),
        },
      }
    );
  } catch (error) {
    console.error("Error al despachar alerta de producción:", error);
  }
}

/**
 * Alertas automáticas para cinética y estado de fermentación en tinas.
 */
export async function notifyFermentationAlert(input: {
  lotCode: string;
  fermentationId: string;
  tankName: string;
  status: string;
  brix?: number | null;
  temperature?: number | null;
  ph?: number | null;
  isStuckRisk?: boolean;
}) {
  const { lotCode, fermentationId, tankName, status, brix, temperature, isStuckRisk } = input;
  const href = `/fermentation/${fermentationId}`;

  // 1. Alerta crítica de estrés térmico (> 35°C)
  if (temperature !== null && temperature !== undefined && temperature > 35) {
    await dispatchProductionAlert({
      title: "🔥 Temperatura Crítica en Fermentación",
      body: `Tina ${tankName} (Lote ${lotCode}) alcanzó ${temperature.toFixed(1)}°C. ¡Riesgo inminente de estrés y mortandad de levadura! Revisa enfriamiento.`,
      priority: "URGENT",
      href,
      metadata: { fermentationId, lotCode, temperature },
    });
    return;
  }

  // 2. Alerta de fermentación estancada
  if (isStuckRisk || status === "ESTANCADA") {
    await dispatchProductionAlert({
      title: "⚠️ Fermentación Estancada",
      body: `Tina ${tankName} (Lote ${lotCode}) presenta desaceleración crítica de atenuación (${brix?.toFixed(1) ?? "—"} °Bx). Evalúa nutrientes o aireación con el Maestro Tequilero.`,
      priority: "HIGH",
      href,
      metadata: { fermentationId, lotCode, brix },
    });
    return;
  }

  // 3. Mosto muerto listo para destilación (Brix <= 1.5)
  if (brix !== null && brix !== undefined && brix <= 1.5) {
    await dispatchProductionAlert({
      title: "✨ Mosto Muerto Listo para Destilar",
      body: `Tina ${tankName} (Lote ${lotCode}) completó consumo de azúcares (${brix.toFixed(1)} °Bx). Traslada a destrozado para evitar acidez volátil.`,
      priority: "HIGH",
      href,
      metadata: { fermentationId, lotCode, brix },
    });
    return;
  }
}

/**
 * Alerta al concluir cocimiento o cambio térmico relevante.
 */
export async function notifyCookingAlert(input: {
  lotCode: string;
  cookingId: string;
  ovenName: string;
  type: "START_STEAM" | "TEMP_WARNING" | "FINISHED";
  temperature?: number | null;
  finalAgaveKg?: number | null;
  sweetHoneyLiters?: number | null;
}) {
  const { lotCode, cookingId, ovenName, type, temperature, finalAgaveKg, sweetHoneyLiters } = input;
  const href = `/cooking/${cookingId}`;

  if (type === "TEMP_WARNING" && temperature) {
    await dispatchProductionAlert({
      title: "🌡️ Alerta Térmica en Horno",
      body: `Horno ${ovenName} (Lote ${lotCode}) registró ${temperature.toFixed(1)}°C fuera del rango óptimo de hidrólisis (85-98°C).`,
      priority: "HIGH",
      href,
      metadata: { cookingId, lotCode, temperature },
    });
  } else if (type === "FINISHED") {
    await dispatchProductionAlert({
      title: "✅ Cocción de Agave Concluida",
      body: `Horno ${ovenName} (Lote ${lotCode}) finalizado con ${finalAgaveKg?.toLocaleString() ?? "—"} kg de agave cocido y ${sweetHoneyLiters?.toLocaleString() ?? 0} L de mieles dulces recuperadas.`,
      priority: "NORMAL",
      href,
      metadata: { cookingId, lotCode, finalAgaveKg, sweetHoneyLiters },
    });
  } else if (type === "START_STEAM") {
    await dispatchProductionAlert({
      title: "💨 Inyección de Vapor Iniciada",
      body: `Se activó inyección de vapor en horno ${ovenName} para el lote ${lotCode}. Inicia desamargue.`,
      priority: "NORMAL",
      href,
      metadata: { cookingId, lotCode },
    });
  }
}

/**
 * Alerta al concluir molienda.
 */
export async function notifyMillingAlert(input: {
  lotCode: string;
  millingId: string;
  mashLiters: number;
  brix: number;
  sugarKg: number;
  efficiency: number;
}) {
  const { lotCode, millingId, mashLiters, brix, sugarKg, efficiency } = input;
  await dispatchProductionAlert({
    title: "⚙️ Molienda Concluida",
    body: `Lote ${lotCode}: Se obtuvieron ${mashLiters.toLocaleString()} L de mosto a ${brix.toFixed(1)} °Bx (${sugarKg.toFixed(1)} kg azúcar extraído, ${efficiency.toFixed(1)}% eficiencia). Listo para fermentación.`,
    priority: "NORMAL",
    href: `/milling/${millingId}`,
    metadata: { millingId, lotCode, mashLiters, brix, sugarKg, efficiency },
  });
}

/**
 * Alerta de cortes y finalización de destilación.
 */
export async function notifyDistillationAlert(input: {
  lotCode: string;
  distillationId: string;
  stillName: string;
  type: "DESTROZADO" | "RECTIFICACION";
  heartLiters: number;
  alcoholPercent: number;
  laa: number;
}) {
  const { lotCode, distillationId, stillName, type, heartLiters, alcoholPercent, laa } = input;
  const isRectificacion = type === "RECTIFICACION";
  const title = isRectificacion ? "🥃 Tequila Blanco Obtenido (Rectificación)" : "🍶 Ordinario Obtenido (Destrozado)";
  const body = isRectificacion
    ? `Alambique ${stillName} (Lote ${lotCode}): ${heartLiters.toLocaleString()} L de corazón a ${alcoholPercent.toFixed(1)}% Alc. Vol. (${laa.toFixed(1)} LAA). ¡Tequila de alta calidad listo!`
    : `Alambique ${stillName} (Lote ${lotCode}): ${heartLiters.toLocaleString()} L de ordinario a ${alcoholPercent.toFixed(1)}% Alc. Vol. (${laa.toFixed(1)} LAA) obtenidos. Listo para rectificar.`;

  await dispatchProductionAlert({
    title,
    body,
    priority: isRectificacion ? "HIGH" : "NORMAL",
    href: `/distillation/${distillationId}`,
    metadata: { distillationId, lotCode, type, heartLiters, alcoholPercent, laa },
  });
}

/**
 * Alerta operativa de Caldera.
 */
export async function notifyBoilerAlert(input: {
  equipmentName: string;
  sessionId?: string;
  issue: "LOW_PRESSURE" | "LOW_GAS" | "STOPPED";
  value?: number;
}) {
  const { equipmentName, sessionId, issue, value } = input;
  const href = "/boiler";

  if (issue === "LOW_PRESSURE") {
    await dispatchProductionAlert({
      title: "⚠️ Caldera: Presión de Vapor Baja",
      body: `${equipmentName} reporta presión baja (${value?.toFixed(1) ?? "—"} PSI). Posible impacto en temperatura de cocimiento o destilación.`,
      priority: "HIGH",
      href,
      metadata: { equipmentName, sessionId, pressure: value },
    });
  } else if (issue === "LOW_GAS") {
    await dispatchProductionAlert({
      title: "⛽ Caldera: Nivel de Gas Crítico",
      body: `${equipmentName} registra nivel de gas LP en ${value?.toFixed(1) ?? "—"}% (reserva baja). Programa recarga para evitar paro de producción.`,
      priority: "URGENT",
      href,
      metadata: { equipmentName, sessionId, gasPercent: value },
    });
  } else if (issue === "STOPPED") {
    await dispatchProductionAlert({
      title: "🛑 Caldera Apagada",
      body: `Se registró apagado de ${equipmentName}. Sesión de vapor concluida.`,
      priority: "NORMAL",
      href,
      metadata: { equipmentName, sessionId },
    });
  }
}

/**
 * Alerta de nuevo lote iniciado.
 */
export async function notifyLotCreated(input: {
  lotCode: string;
  lotId: string;
  agaveKg: number;
  art?: number | null;
  theoreticalLiters: number;
}) {
  const { lotCode, lotId, agaveKg, art, theoreticalLiters } = input;
  await dispatchProductionAlert({
    title: "🌱 Nuevo Lote Tequilero Iniciado",
    body: `Lote ${lotCode} registrado con ${agaveKg.toLocaleString()} kg de agave (${art ?? 26}% ART). Rendimiento proyectado: ~${theoreticalLiters.toLocaleString()} L de tequila al 40%.`,
    priority: "NORMAL",
    href: `/lots/${lotId}`,
    metadata: { lotId, lotCode, agaveKg, art },
  });
}

/**
 * Alerta de Lote 100% finalizado.
 */
export async function notifyLotCompleted(input: {
  lotCode: string;
  lotId: string;
  totalLiters: number;
  agaveKg: number;
  yieldKgPerLiter: number;
  costPerLiter: number;
}) {
  const { lotCode, lotId, totalLiters, agaveKg, yieldKgPerLiter, costPerLiter } = input;
  await dispatchProductionAlert({
    title: "🏆 Lote Tequilero Finalizado",
    body: `¡Lote ${lotCode} concluido! ${totalLiters.toLocaleString()} L producidos a partir de ${agaveKg.toLocaleString()} kg de agave. Rendimiento: ${yieldKgPerLiter.toFixed(2)} kg/L. Costo: $${costPerLiter.toFixed(2)}/L.`,
    priority: "HIGH",
    href: `/lots/${lotId}`,
    metadata: { lotId, lotCode, totalLiters, agaveKg, yieldKgPerLiter, costPerLiter },
  });
}
