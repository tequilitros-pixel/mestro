import Link from "next/link";
import NotificationRuleForm from "../NotificationRuleForm";

export default function NewNotificationRulePage() {
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
          <h1 className="text-3xl font-bold sm:text-4xl">Nueva regla</h1>
        </div>

        <NotificationRuleForm />
      </div>
    </main>
  );
}
