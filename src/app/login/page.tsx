"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ApiError, loginWithPassword, registerWithPassword } from "@/lib/garr-api";
import { setAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_GARR_API_BASE_URL ?? "";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token =
        mode === "register"
          ? await registerWithPassword(email, password, displayName || undefined)
          : await loginWithPassword(email, password);

      setAuthToken(token);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Sign In"
      description="Sign in to manage your organization's index record."
    >
      <div className="mx-auto max-w-sm space-y-5">
        {/* Email / password form */}
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          {/* Mode toggle */}
          <div className="mb-5 flex rounded-xl border border-black/10 p-1 text-sm">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${
                mode === "login" ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${
                mode === "register" ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-950 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "…" : mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex-1 border-t border-black/10" />
          or continue with
          <div className="flex-1 border-t border-black/10" />
        </div>

        {/* OAuth buttons */}
        <a
          href={`${API_BASE}/auth/google`}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </a>

        <a
          href={`${API_BASE}/auth/github`}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          Continue with GitHub
        </a>

        <p className="text-center text-xs text-slate-400">
          <Link href="/registries" className="underline hover:text-slate-600">
            Browse public records
          </Link>{" "}
          without signing in.
        </p>
      </div>
    </PageShell>
  );
}
