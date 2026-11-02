import { redirect } from "next/navigation";

/** Compatibility destination for cash-cut notifications issued before /daily was added. */
export default async function LegacyCashCutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/cash-cuts/daily/${encodeURIComponent(id)}`);
}
