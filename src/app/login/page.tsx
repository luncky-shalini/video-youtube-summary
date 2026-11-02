'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GoogleIcon } from '@/components/GoogleSignInButton';

function LoginCard() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const hadError = searchParams.get('error') === 'auth';
  const next = searchParams.get('next') ?? '/dashboard';

  async function signInWithGoogle() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });
    } catch (err) {
      console.error('Sign in error:', err);
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:p-10">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 via-cyan-500 to-emerald-400 p-0.5 shadow-glow-sm">
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950 text-white">
            <Sparkles className="h-6 w-6 text-cyan-400" />
          </div>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Sign In to <span className="bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">SynapseTube</span>
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          Sign in with Google to enter your authenticated video workspace, transcribe videos, translate subtitles, and export complete study synopses.
        </p>
      </div>

      {hadError && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/80 p-3.5 text-center text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
          Sign-in failed. Please try again with your authorized Google account.
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm sm:text-base font-bold text-slate-700 shadow-sm transition-all duration-200 hover:border-teal-500/50 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-teal-500/50 dark:hover:bg-slate-750"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-teal-600" /> : <GoogleIcon className="h-5 w-5" />}
          <span>Continue with Google</span>
        </button>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span>Secured via Supabase Auth &bull; Protected Workspace Access</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col justify-between bg-slate-50 p-4 sm:p-6 lg:p-8 bg-grid-pattern dark:bg-[#0b0f19]">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Top Navigation */}
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 via-cyan-500 to-emerald-400 p-0.5 shadow-glow-sm">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-white">
              <Sparkles className="h-4 w-4 text-cyan-400" />
            </div>
          </div>
          <span className="text-base font-black tracking-tight sm:text-lg text-slate-900 dark:text-white">
            Synapse<span className="bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">Tube</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 transition"
          >
            &larr; Back to Home
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Centered Auth Card */}
      <div className="my-auto flex w-full justify-center py-10">
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="h-64 rounded-3xl bg-slate-100 animate-pulse dark:bg-slate-800" />}>
            <LoginCard />
          </Suspense>
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="mx-auto w-full max-w-7xl py-4 text-center text-xs text-slate-400 dark:text-slate-600">
        SynapseTube &copy; {new Date().getFullYear()} &bull; Authenticated Workspace
      </footer>
    </main>
  );
}
