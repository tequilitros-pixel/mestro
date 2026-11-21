import { redirect } from "next/navigation";

/** Compatibility destination for older event-recount notifications. */
export default function LegacyEventsPage() {
  redirect("/administration/inventory/events");
}
