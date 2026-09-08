"use client";

import type { ReactNode } from "react";
import OfflineOperationForm from "./OfflineOperationForm";
import type { OfflineOperation } from "@/lib/offline/types";

export default function OfflineBoilerForm({ kind, entityField, entityId, fallbackAction, children, className }: {
  kind: Extract<OfflineOperation["kind"], `boiler.${string}` | `steam.${string}` | "sweet-honey.recovery.create">;
  entityField: string;
  entityId: string;
  fallbackAction?: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  return <OfflineOperationForm kind={kind} entityField={entityField} entityId={entityId} fallbackAction={fallbackAction} className={className}>{children}</OfflineOperationForm>;
}
