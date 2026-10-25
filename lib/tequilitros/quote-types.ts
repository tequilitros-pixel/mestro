export const OFFICIAL_WHATSAPP_PHONE = "525662989202";
export const OFFICIAL_WHATSAPP_DISPLAY = "+52 56 6298 9202";
export const MAX_CONFIRMED_EVENTS_PER_DAY = 3;

export const VIATICOS_OPTIONS = [
  { id: "colotlan", label: "Colotlán y alrededores cercanos", cost: 0 },
  { id: "canoas", label: "Canoas y comunidades vecinas", cost: 0 },
  { id: "tlaltenango", label: "Tlaltenango, Jerez, Santa María ($500)", cost: 500 },
  { id: "zacatecas", label: "Zacatecas Capital, Fresnillo ($800)", cost: 800 },
  { id: "guadalajara", label: "Guadalajara, Zapopan o foráneo ($1,200)", cost: 1200 },
  { id: "otro", label: "Otra localidad (por calcular)", cost: 500 },
] as const;

export const DRINKS_CATALOG = [
  "Cantarito",
  "Paloma",
  "Vampiro",
  "Tequimiche",
  "Tequimora",
  "Tequimojito",
  "Coscorrón",
  "Botellas de Tequila Blanco/Reposado para mesas",
] as const;

export const EVENT_TYPES = [
  "Boda",
  "XV Años",
  "Cumpleaños / Fiesta privada",
  "Graduación",
  "Bautizo / Primera Comunión",
  "Evento Corporativo / Empresarial",
  "Posada / Fin de Año",
  "Otro",
] as const;

export interface TequilitrosQuoteMetadata {
  version: 1;
  type: "TEQUILITROS_QUOTE";
  folio: string; // Ej: COT-2026-0042
  clientEmail?: string;
  eventType: string;
  modality: "libre" | "consumo" | "personalizado";
  durationHours: number;
  extraHours: number;
  extraHoursCost: number;
  pricePerGuest: number;
  viaticosId: string;
  viaticosZone: string;
  viaticosCost: number;
  selectedDrinks: string[];
  depositRequired: number; // 50%
  balanceRemaining: number;
  specialNotes?: string;

  // Empleado y Sucursal emisora
  createdById: string;
  creatorName: string;
  branchId?: string;
  branchName?: string;

  // Contrato y Anticipo formal
  isContractConfirmed?: boolean;
  contractFolio?: string; // Ej: CTR-2026-0827
  depositPaid?: number;
  depositMethod?: string; // "Efectivo en Sucursal" | "Transferencia Bancaria" | "Tarjeta"
  depositPaidAt?: string;
  depositReceivedById?: string;
  depositReceivedByName?: string;
  depositBranchName?: string;
  contractNotes?: string;
}

export interface DayAvailability {
  dateStr: string; // YYYY-MM-DD
  confirmedCount: number;
  pendingCount: number;
  status: "GREEN" | "YELLOW" | "RED";
  events: Array<{
    id: string;
    code: string;
    clientName: string;
    guestCount: number;
    status: string;
    creatorName: string;
    isConfirmed: boolean;
  }>;
}

export interface EmployeeLeaderboardItem {
  userId: string;
  userName: string;
  quotesCount: number;
  confirmedContractsCount: number;
  totalQuotedAmount: number;
  totalConfirmedAmount: number;
}

export const OFFICIAL_CONTRACT_CLAUSES = [
  {
    title: "1. Anticipo y Apartado de Fecha",
    body: "Se requiere un anticipo obligatorio del 50% del valor total presupuestado para congelar y reservar la fecha en agenda oficial. Dicho apartado se valida a través del WhatsApp central de Tequilitros Eventos (+52 56 6298 9202).",
  },
  {
    title: "2. Política de No Reembolso",
    body: "El anticipo entregado es estrictamente NO REEMBOLSABLE bajo ninguna circunstancia, derivado del bloqueo exclusivo de fecha en el calendario, asignación de equipo y rechazo de solicitudes de otros clientes para ese mismo día.",
  },
  {
    title: "3. Cómputo de Aforo Total (Barra Libre)",
    body: "La modalidad de Barra Libre se cotiza y contrata por el 100% de las personas asistentes al evento (incluyendo niños, jóvenes y adultos sin excepción). Todos los asistentes son considerados invitados, dado que el servicio provee de forma ilimitada tanto coctelería con tequila para adultos como refrescos, jugos, aguas minerales, hielo, vasos, escarchados y preparaciones sin alcohol para menores y no bebedores.",
  },
  {
    title: "4. Política de Cambios de Fecha o Sede",
    body: "Cualquier solicitud de cambio de fecha o ubicación deberá solicitarse con un mínimo de 15 días naturales de anticipación y estará estrictamente sujeta a la disponibilidad de agenda y aprobación mutua de Tequilitros. Si no hay disponibilidad para la fecha deseada por el cliente y no se llega a un acuerdo para otra fecha, prevalecerá la fecha original o se dará por cancelado el servicio sin derecho a reembolso del anticipo. Con menos de 15 días de anticipación no se admitirá ningún cambio.",
  },
  {
    title: "5. Asistentes Excedentes y Penalización",
    body: "El servicio se suministra con base en el aforo pactado en este contrato. En caso de que el día del evento la asistencia real supere la cifra contratada, cada invitado adicional será cobrado al precio unitario correspondiente más un recargo del 10% extra por concepto de insumos y logística imprevista, debiendo liquidarse durante el desarrollo del evento.",
  },
  {
    title: "6. Liquidación del Saldo",
    body: "El 50% restante del saldo total deberá liquidarse en su totalidad el día del evento, previo al inicio del servicio de la barra móvil.",
  },
] as const;
