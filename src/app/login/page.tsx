"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUpRight, Palette, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { requestPasswordReset } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";

const STATS: { label: string; value: string; delta: string; wide?: boolean }[] = [
  { label: "Active sellers", value: "2,418", delta: "+12.4%" },
  { label: "Requests resolved", value: "96.2%", delta: "+3.1%" },
  { label: "GMV this month", value: "$184,230", delta: "+8.7% vs July 2026", wide: true },
];

const GENERIC_ERROR = "Something went wrong while signing you in. Try again.";

export default function LoginPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Already signed in (e.g. navigated back here) — straight to the console.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : GENERIC_ERROR);
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const target = email.trim();
    setError(null);
    if (!target) {
      setNotice("Enter your email above first, then tap “Forgot password?” again.");
      return;
    }
    try {
      await requestPasswordReset(target);
    } catch {
      // Same neutral confirmation either way — this flow never confirms whether an account exists.
    }
    setNotice(`If an account exists for ${target}, a reset link is on its way.`);
  }

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Left: sign-in form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <Card className="p-8">
            <div className="mb-8 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
                <Palette size={22} />
              </span>
              <span>
                <span className="block text-lg font-bold leading-tight tracking-tight text-ink">
                  Pastel
                </span>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                  Admin Console
                </span>
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Sign in to Pastel Admin
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Manage content, users, and operations for the Pastel marketplace.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
                >
                  <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}
              {notice && (
                <p
                  role="status"
                  className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700"
                >
                  {notice}
                </p>
              )}
              <Input
                label="Email"
                type="email"
                required
                placeholder="you@pastel.app"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Password"
                type="password"
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" loading={loading} className="w-full">
                Sign in
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-ink-muted">
              Operator access only — accounts without an active admin membership cannot sign in.
            </p>
          </Card>
          <p className="mt-6 text-center text-xs text-ink-muted">
            © 2026 Pastel, Inc. · Internal tools
          </p>
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:px-14 xl:px-20">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-cream/10 blur-3xl"
        />

        <div className="relative max-w-lg">
          <div className="flex items-center gap-2.5 text-cream/90">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <Palette size={16} />
            </span>
            <span className="text-sm font-semibold tracking-wide">Pastel Marketplace</span>
          </div>

          <h2 className="mt-8 text-4xl font-bold leading-tight tracking-tight text-white">
            Everything your marketplace team needs, in one console.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-cream/80">
            Curate content, resolve requests, and keep operations humming — from
            waitlists to sales tax, all in one warm, fast workspace.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className={
                  "rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm" +
                  (stat.wide ? " col-span-2" : "")
                }
              >
                <p className="text-xs font-medium uppercase tracking-wider text-cream/70">
                  {stat.label}
                </p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-white">
                  {stat.value}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-cream">
                  <ArrowUpRight size={13} aria-hidden />
                  {stat.delta}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 flex items-center gap-2 text-xs text-cream/60">
            <ShieldCheck size={14} aria-hidden />
            Internal use only · Pastel operations team
          </p>
        </div>
      </div>
    </div>
  );
}
