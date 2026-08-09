import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-xl">Recipe Vault</span>
        </div>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-tight">
            Every recipe worth keeping, in one considered place.
          </p>
          <p className="mt-4 text-primary-foreground opacity-80">
            A private home for the dishes you actually cook.
          </p>
        </div>
        <p className="text-sm text-primary-foreground opacity-60">
          Your personal cookbook — no ads, no clutter.
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent opacity-20 blur-3xl"
        />
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark className="text-primary" />
            <span className="font-display text-xl text-foreground">
              Recipe Vault
            </span>
          </div>

          <h1 className="font-display text-2xl text-foreground">Welcome back</h1>
          <p className="mt-1.5 text-sm text-foreground-muted">
            Sign in to your kitchen.
          </p>

          <div className="mt-7">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground ${className ?? ""}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 3v7a3 3 0 0 0 6 0V3" />
        <path d="M9 10v11" />
        <path d="M18 3c-1.5 0-3 1.8-3 5s1.5 4 3 4" />
        <path d="M18 3v18" />
      </svg>
    </span>
  );
}
