"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Mode = "signin" | "reset";

export function LoginForm() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirectTo");
  // Only allow same-app paths — never an absolute URL (open-redirect guard).
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : "/";
  const urlError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // Full navigation so the server and middleware read the fresh session cookie.
    window.location.assign(redirectTo);
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Check your email for a link to reset your password.");
  }

  const isReset = mode === "reset";

  return (
    <form
      onSubmit={isReset ? handleReset : handleSignIn}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      {!isReset ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setError(null);
                setMessage(null);
              }}
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      ) : null}

      {(error || urlError) && !message ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error ?? urlError}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          {message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
        {loading
          ? "Please wait…"
          : isReset
            ? "Send reset link"
            : "Sign in"}
      </Button>

      {isReset ? (
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
            setMessage(null);
          }}
          className="text-sm font-medium text-foreground-muted hover:text-foreground"
        >
          ← Back to sign in
        </button>
      ) : null}
    </form>
  );
}
