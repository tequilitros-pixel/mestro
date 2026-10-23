import { redirect } from "next/navigation";

export default function LegacyLiquorQrPage() {
  redirect("/liquors/production/labels/new");
}
