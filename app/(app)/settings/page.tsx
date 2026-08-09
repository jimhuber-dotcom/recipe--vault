import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SettingsIcon } from "@/components/nav/icons";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Preferences and account controls."
        actions={<SignOutButton />}
      />
      <EmptyState
        icon={<SettingsIcon className="h-6 w-6" />}
        title="Settings are coming"
        description="Profile, measurement units, and preferences land in a later phase. For now, you can sign out above."
      />
    </div>
  );
}
