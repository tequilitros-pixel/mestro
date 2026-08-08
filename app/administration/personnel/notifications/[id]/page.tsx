import Link from "next/link";
import { notFound } from "next/navigation";
import { getNotificationRuleById } from "@/app/actions/notificationRules";
import NotificationRuleForm from "../NotificationRuleForm";

export default async function EditNotificationRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rule = await getNotificationRuleById(id);

  if (!rule) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link
            href="/administration/personnel/notifications"
            className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            ← Notificaciones
          </Link>
          <h1 className="text-3xl font-bold sm:text-4xl">{rule.name}</h1>
        </div>

        <NotificationRuleForm
          initialValues={{
            id: rule.id,
            name: rule.name,
            triggerType: rule.triggerType,
            checkFrequencyMinutes: rule.checkFrequencyMinutes,
            recipientRoles: rule.recipientRoles,
            thresholdConfig: rule.thresholdConfig as {
              daysBeforeExpiration?: number;
              minDifference?: number;
            } | null,
          }}
        />
      </div>
    </main>
  );
}
