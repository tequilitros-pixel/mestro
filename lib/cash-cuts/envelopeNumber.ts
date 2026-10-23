import { formatBusinessDateOnly } from "@/lib/dateTime";

/** Número visible del sobre según la fecha del cierre en Ciudad de México. */
export function envelopeNumberForClose(closedAt: Date | string): string {
  return formatBusinessDateOnly(closedAt).slice(5);
}
