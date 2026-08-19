import { notFound } from "next/navigation";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DiscountAnalyticsDashboard from "@/components/pos/DiscountAnalyticsDashboard";
import {
  getDiscountAnalytics,
  type DiscountReportMode,
} from "@/lib/pos/discountAnalytics";

const MODES = new Set<DiscountReportMode>(["courtesies", "employees", "products"]);

export default async function DiscountReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ days?: string; branch?: string }>;
}) {
  const [{ mode: rawMode }, query, allowedBranchIds, user] = await Promise.all([
    params,
    searchParams,
    getAccessibleBranchIds(),
    getCurrentUser(),
  ]);

  if (!user) return null;

  if (!MODES.has(rawMode as DiscountReportMode)) notFound();
  const mode = rawMode as DiscountReportMode;
  const requestedDays = Number(query.days);
  const days = requestedDays === 7 || requestedDays === 90 ? requestedDays : 30;
  const branchId = query.branch ?? "";

  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const validBranchId = branches.some((branch) => branch.id === branchId) ? branchId : "";
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));

  const analytics = await getDiscountAnalytics({
    mode,
    from,
    branchIds: allowedBranchIds,
    selectedBranchId: validBranchId,
    user,
  });

  return (
    <DiscountAnalyticsDashboard
      mode={mode}
      analytics={analytics}
      branches={branches}
      days={days}
      branchId={validBranchId}
    />
  );
}
