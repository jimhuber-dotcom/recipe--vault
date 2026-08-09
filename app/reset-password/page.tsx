import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-foreground">
          Set a new password
        </h1>
        <p className="mt-1.5 text-sm text-foreground-muted">
          Choose a new password for your account.
        </p>
        <div className="mt-7">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
