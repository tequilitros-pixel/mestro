import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import GlobalHeader from "@/app/components/GlobalHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader user={user} />
      <main>{children}</main>
    </div>
  );
}
