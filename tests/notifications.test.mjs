import test from "node:test";
import assert from "node:assert/strict";

function getCategoryBadge(category) {
  switch (category) {
    case "POS":
      return { label: "Punto de Venta", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: "💳" };
    case "TIMECLOCK":
      return { label: "Checador / Turnos", color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", icon: "⏰" };
    case "PAYROLL":
      return { label: "Nómina", color: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30", icon: "💵" };
    case "INVENTORY":
      return { label: "Inventario", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30", icon: "📦" };
    case "PRODUCTION":
      return { label: "Producción", color: "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30", icon: "🥃" };
    case "SYSTEM":
    default:
      return { label: "Sistema", color: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30", icon: "⚙️" };
  }
}

function formatRelativeTime(isoString, nowMs = Date.now()) {
  try {
    const diff = (nowMs - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return "Hace un momento";
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    const days = Math.floor(diff / 86400);
    if (days === 1) return "Ayer";
    if (days < 7) return `Hace ${days} d`;
    return new Date(isoString).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

test("Notification category mappings provide valid labels and icons", () => {
  const categories = [
    "POS",
    "TIMECLOCK",
    "PAYROLL",
    "INVENTORY",
    "PRODUCTION",
    "SYSTEM",
  ];

  for (const cat of categories) {
    const badge = getCategoryBadge(cat);
    assert.ok(badge.label.length > 0, `Category ${cat} should have label`);
    assert.ok(badge.icon.length > 0, `Category ${cat} should have icon`);
    assert.ok(badge.color.includes("border-"), `Category ${cat} should include tailwind border class`);
  }
});
test("Relative time formatter computes expected human-readable strings", () => {
  const baseTime = new Date("2026-10-27T10:00:00Z").getTime();

  // 15 seconds ago -> "Hace un momento"
  const justNow = new Date(baseTime - 15 * 1000).toISOString();
  assert.equal(formatRelativeTime(justNow, baseTime), "Hace un momento");

  // 5 minutes ago -> "Hace 5 min"
  const fiveMinAgo = new Date(baseTime - 5 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(fiveMinAgo, baseTime), "Hace 5 min");

  // 3 hours ago -> "Hace 3 h"
  const threeHoursAgo = new Date(baseTime - 3 * 3600 * 1000).toISOString();
  assert.equal(formatRelativeTime(threeHoursAgo, baseTime), "Hace 3 h");

  // 1 day ago -> "Ayer"
  const yesterday = new Date(baseTime - 86400 * 1000).toISOString();
  assert.equal(formatRelativeTime(yesterday, baseTime), "Ayer");

  // 4 days ago -> "Hace 4 d"
  const fourDaysAgo = new Date(baseTime - 4 * 86400 * 1000).toISOString();
  assert.equal(formatRelativeTime(fourDaysAgo, baseTime), "Hace 4 d");
});

test("Notification unread count badges display logic", () => {
  const formatBadge = (unreadCount) => {
    if (unreadCount <= 0) return null;
    return unreadCount > 99 ? "99+" : String(unreadCount);
  };

  assert.equal(formatBadge(0), null);
  assert.equal(formatBadge(1), "1");
  assert.equal(formatBadge(15), "15");
  assert.equal(formatBadge(99), "99");
  assert.equal(formatBadge(100), "99+");
  assert.equal(formatBadge(500), "99+");
});
