export type EquipmentStatus =
  | "OPERANDO"
  | "LIBRE"
  | "ESPERANDO"
  | "MANTENIMIENTO"
  | "ALERTA";

export interface PlantEquipment {
  id: string;
  name: string;
  type:
    | "HORNO"
    | "MOLIENDA"
    | "PRENSA"
    | "TINA"
    | "ALAMBIQUE"
    | "CALDERA"
    | "TANQUE";

  capacity?: number;

  status: EquipmentStatus;

  health: number;

  currentLot?: string;

  metrics: Record<string, number | string>;
}

export class PlantModel {
  static equipment: PlantEquipment[] = [

    {
      id: "HORNO-1",
      name: "Horno 1",
      type: "HORNO",
      status: "OPERANDO",
      health: 98,
      currentLot: "AG-2026-001",

      metrics: {
        temperatura: 92,
        horas: 33,
      },
    },

    {
      id: "MOL-1",
      name: "Desgarradora",
      type: "MOLIENDA",
      status: "LIBRE",
      health: 100,

      metrics: {
        eficiencia: 88,
      },
    },

    {
      id: "PRENSA-1",
      name: "Prensa",
      type: "PRENSA",
      status: "LIBRE",
      health: 96,

      metrics: {
        extraccion: 90,
      },
    },

    {
      id: "TINA-1",
      name: "Tina 1",
      type: "TINA",
      status: "OPERANDO",
      health: 99,

      metrics: {
        alcohol: 6.8,
        ph: 4.4,
      },
    },

    {
      id: "TINA-2",
      name: "Tina 2",
      type: "TINA",
      status: "OPERANDO",
      health: 98,

      metrics: {
        alcohol: 5.4,
        ph: 4.6,
      },
    },

    {
      id: "TINA-3",
      name: "Tina 3",
      type: "TINA",
      status: "LIBRE",
      health: 100,

      metrics: {},
    },

    {
      id: "TINA-4",
      name: "Tina 4",
      type: "TINA",
      status: "LIBRE",
      health: 100,

      metrics: {},
    },

    {
      id: "AL-1",
      name: "Alambique 1",
      type: "ALAMBIQUE",
      status: "OPERANDO",
      health: 98,

      metrics: {
        alcohol: 58,
      },
    },

    {
      id: "AL-2",
      name: "Alambique 2",
      type: "ALAMBIQUE",
      status: "LIBRE",
      health: 100,

      metrics: {},
    },

    {
      id: "AL-3",
      name: "Alambique 3",
      type: "ALAMBIQUE",
      status: "LIBRE",
      health: 100,

      metrics: {},
    },

    {
      id: "CALDERA",
      name: "Caldera",
      type: "CALDERA",
      status: "OPERANDO",
      health: 99,

      metrics: {
        vapor: 100,
      },
    },

    {
      id: "TANQUE",
      name: "Tanque de recepción",
      type: "TANQUE",
      status: "OPERANDO",
      health: 100,

      metrics: {},
    },
  ];

  static all() {
    return this.equipment;
  }

  static byType(type: PlantEquipment["type"]) {
    return this.equipment.filter((e) => e.type === type);
  }

  static operating() {
    return this.equipment.filter((e) => e.status === "OPERANDO");
  }
}