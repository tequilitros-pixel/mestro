/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Módulo:
 * Personal — visuales compartidos por rol
 *
 * Propósito:
 * Centraliza etiquetas, iconos y clases de color por rol de
 * usuario para que la lista, la ficha y los permisos de
 * Personal se vean consistentes entre sí.
 * ==========================================================
 */

import {
  CrownIcon,
  StarIcon,
  ShieldIcon,
  GearIcon,
  EyeIcon,
  type IconProps,
} from "@/components/ui/icons";
import { ComponentType } from "react";

export type PersonnelRole =
  | "ADMIN"
  | "OPERATOR"
  | "GERENTE"
  | "ENCARGADO"
  | "CONSULTA";

export const ROLE_LABELS: Record<PersonnelRole, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operador",
  GERENTE: "Gerente",
  ENCARGADO: "Encargado",
  CONSULTA: "Consulta",
};

export const ROLES_CON_SUCURSAL: PersonnelRole[] = ["GERENTE", "ENCARGADO"];

export const ROLE_ICON: Record<PersonnelRole, ComponentType<IconProps>> = {
  ADMIN: CrownIcon,
  GERENTE: StarIcon,
  ENCARGADO: ShieldIcon,
  OPERATOR: GearIcon,
  CONSULTA: EyeIcon,
};

/** Insignia de rol (fondo + texto + borde). */
export const ROLE_BADGE_CLASS: Record<PersonnelRole, string> = {
  ADMIN: "border-primary/30 bg-primary/10 text-primary",
  GERENTE: "border-outline bg-surface-container-highest text-on-surface",
  ENCARGADO:
    "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim",
  OPERATOR: "border-outline-variant bg-surface-container-high text-on-surface-variant",
  CONSULTA: "border-outline-variant bg-surface-container-high text-outline",
};

/** Avatar circular (fondo + texto + anillo). */
export const ROLE_AVATAR_CLASS: Record<PersonnelRole, string> = {
  ADMIN: "bg-primary/15 text-primary ring-primary/30",
  GERENTE: "bg-surface-container-highest text-on-surface ring-outline",
  ENCARGADO:
    "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim ring-tertiary-fixed-dim/30",
  OPERATOR: "bg-surface-container-highest text-on-surface-variant ring-outline-variant",
  CONSULTA: "bg-surface-container-highest text-outline ring-outline-variant",
};

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[1][0]).toUpperCase();
}
