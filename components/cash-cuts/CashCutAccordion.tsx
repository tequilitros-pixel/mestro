"use client";
import { ChevronDownIcon } from "@/components/ui/icons";
import { useState } from "react";

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  highlight?: boolean;
}

export function Accordion({ title, children, defaultOpen = false, highlight = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-2xl border transition ${open ? "border-outline bg-surface-container-high" : "border-outline-variant bg-surface"}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 flex items-center justify-between text-left font-semibold transition ${
          highlight
            ? "bg-primary/10 text-primary"
            : "text-on-surface hover:bg-surface-container-high"
        }`}
      >
        <span>{title}</span>
        <ChevronDownIcon className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-outline-variant px-4 py-3 space-y-2">{children}</div>}
    </div>
  );
}
