import { getCurrentUser } from "@/lib/auth";
import BranchesClient from "./BranchesClient";

export default async function BranchesPage() {
  const user = await getCurrentUser();

  return <BranchesClient isAdmin={user?.role === "ADMIN"} />;
}
