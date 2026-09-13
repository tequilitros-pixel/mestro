import type { ReactNode } from "react";
import OfflineOperationForm from "./OfflineOperationForm";

export default function OfflineCookingForm({
  cookingId,
  children,
  className,
  fallbackAction,
}: {
  cookingId: string;
  children: ReactNode;
  className?: string;
  fallbackAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <OfflineOperationForm
      kind="cooking.event.create"
      entityField="cookingId"
      entityId={cookingId}
      className={className}
      fallbackAction={fallbackAction}
    >
      {children}
    </OfflineOperationForm>
  );
}
