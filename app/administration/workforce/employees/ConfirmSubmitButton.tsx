"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function ConfirmSubmitButton({ children, className, message }: { children: ReactNode; className?: string; message: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}>{pending ? "Guardando…" : children}</button>;
}
