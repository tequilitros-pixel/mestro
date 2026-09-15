"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { enqueueOperation } from "@/lib/offline/queue";
import { syncOfflineQueue } from "@/lib/offline/sync";
import type { OfflineOperation } from "@/lib/offline/types";

type OperationKind = OfflineOperation["kind"];

function serializeForm(form: HTMLFormElement) {
  const formData = new FormData(form);
  const payload: Record<string, string | number | boolean | null> = {};

  for (const [name, rawValue] of formData.entries()) {
    if (rawValue instanceof File) continue;
    const field = form.elements.namedItem(name);
    const input = field instanceof RadioNodeList ? field[0] : field;

    if (input instanceof HTMLInputElement && input.type === "number") {
      payload[name] = rawValue.trim() === "" ? null : Number(rawValue);
    } else if (input instanceof HTMLInputElement && input.type === "checkbox") {
      payload[name] = input.checked;
    } else {
      payload[name] = rawValue.trim() || null;
    }
  }

  return { formData, payload };
}

export default function OfflineOperationForm({
  kind,
  entityField,
  entityId,
  children,
  className,
  fallbackAction,
}: {
  kind: OperationKind;
  entityField: string;
  entityId: string;
  children: ReactNode;
  className?: string;
  fallbackAction?: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    setSaving(true);
    const { formData, payload } = serializeForm(form);

    try {
      await enqueueOperation({
        id: crypto.randomUUID(),
        kind,
        createdAt: new Date().toISOString(),
        payload: { ...payload, [entityField]: entityId },
      });
      form.reset();
      await syncOfflineQueue();
      if (navigator.onLine) router.refresh();
    } catch (error) {
      if (navigator.onLine && fallbackAction) {
        await fallbackAction(formData);
        return;
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className} aria-busy={saving}>
      <fieldset disabled={saving} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
