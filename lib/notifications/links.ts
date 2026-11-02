const CASH_CUT_SECTION_ROUTES = new Set([
  "audit",
  "branches",
  "daily",
  "dashboard",
  "envelopes",
  "expenses",
  "history",
  "safe",
]);

/**
 * Keeps notification destinations stable when a screen has moved. Notifications
 * are persisted and may also be delivered as Web Push, so old links must remain
 * usable after the corresponding UI route changes.
 */
export function canonicalNotificationHref(href: string | null | undefined): string | null {
  if (!href) return null;

  if (href === "/timeclock/my-payroll") return "/timeclock/payroll";
  if (href === "/administration/inventory/eventos/events") {
    return "/administration/inventory/events";
  }

  const cashCutMatch = href.match(/^\/cash-cuts\/([^/?#]+)([?#].*)?$/);
  if (cashCutMatch && !CASH_CUT_SECTION_ROUTES.has(cashCutMatch[1])) {
    return `/cash-cuts/daily/${cashCutMatch[1]}${cashCutMatch[2] ?? ""}`;
  }

  return href;
}
