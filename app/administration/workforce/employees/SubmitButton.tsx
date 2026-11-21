"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
export function SubmitButton({children,className}:{children:ReactNode;className?:string}) {
  const {pending}=useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending} className={`${className??""} disabled:cursor-wait disabled:opacity-60`}>{pending?"Guardando…":children}</button>;
}
