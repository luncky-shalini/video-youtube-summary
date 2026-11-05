'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Loader2,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  UserPlus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';

function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

type AuthMode = 'signin' | 'register';

function LoginCard() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const hadOAuthError = searchParams.get('error') === 'auth';
  const next = searchParams.get('next') ?? '/dashboard';

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  }

  async function signInWithGoogle() {
    setLoadingGoogle(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setErrorMsg(err?.message || 'Google sign-in failed. Please try again.');
      setLoadingGoogle(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    const supabase = createClient();
    setLoadingForm(true);

    try {
      if (mode === 'register') {
        const cleanName = fullName.trim();
        if (!cleanName) {
          setErrorMsg('Please enter your full name.');
          setLoadingForm(false);
          return;
        }

        if (password !== confirmPassword) {
          setErrorMsg('Passwords do not match. Please verify both password fields.');
          setLoadingForm(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              name: cleanName,
            },
          },
        });

        if (error) {
          setErrorMsg(error.message || 'Registration failed. Please try again.');
          setLoadingForm(false);
          return;
        }

        if (data.session) {
          setSuccessMsg('Account created successfully! Redirecting to your workspace...');
          setTimeout(() => {
            window.location.href = next;
          }, 800);
        } else if (data.user) {
          setSuccessMsg(
            'Account created! If confirmation is required, please check your email inbox to verify your account, then sign in.'
          );
          setLoadingForm(false);
        } else {
          setSuccessMsg('Account created successfully! You can now sign in.');
          switchMode('signin');
          setLoadingForm(false);
        }
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setErrorMsg(error.message || 'Invalid email or password. Please check your credentials.');
          setLoadingForm(false);
          return;
        }

        setSuccessMsg('Signed in successfully! Redirecting to your workspace...');
        setTimeout(() => {
          window.location.href = next;
        }, 800);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setErrorMsg(err?.message || 'An unexpected error occurred. Please try again.');
      setLoadingForm(false);
    }
  }

  const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-teal-400 dark:focus:bg-slate-950';

  return (
    <div className="w-full rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:p-10">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 via-cyan-500 to-emerald-400 p-0.5 shadow-glow-sm">
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950 text-white">
            <Sparkles className="h-6 w-6 text-cyan-400" />
          </div>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {mode === 'signin' ? 'Sign In to ' : 'Create an Account on '}
          <span className="bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
            SynapseTube
          </span>
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          {mode === 'signin'
            ? 'Sign in to access your authenticated video workspace, live subtitles, translations, and study synopses.'
            : 'Join SynapseTube to transcribe videos, generate multilingual subtitles, and export study synopses.'}
        </p>
      </div>

      {/* OAuth Error Banner */}
      {hadOAuthError && (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 p-3.5 text-center text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>Google authentication failed. Please try again or use email sign-in.</span>
        </div>
      )}

      {/* Top Continue with Google button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loadingGoogle || loadingForm}
          className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm sm:text-base font-bold text-slate-700 shadow-sm transition-all duration-200 hover:border-teal-500/50 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-teal-500/50 dark:hover:bg-slate-750"
        >
          {loadingGoogle ? (
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          ) : (
            <GoogleIcon className="h-5 w-5" />
          )}
          <span>Continue with Google</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white/95 px-3 font-semibold tracking-wider text-slate-400 backdrop-blur-xl dark:bg-slate-900/90 dark:text-slate-500">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="mb-6 flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80">
        <button
          type="button"
          onClick={() => switchMode('signin')}
          className={`flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 ${
            mode === 'signin'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={`flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 ${
            mode === 'register'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Create New Account
        </button>
      </div>

      {/* Dynamic Feedback Alerts */}
      {errorMsg && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Email Registration & Sign-In Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Full Name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
                autoComplete="name"
                disabled={loadingForm || loadingGoogle}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoComplete="email"
              disabled={loadingForm || loadingGoogle}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Create password (min. 6 chars)' : 'Enter your password'}
              required
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              disabled={loadingForm || loadingGoogle}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mode === 'register' && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                disabled={loadingForm || loadingGoogle}
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loadingForm || loadingGoogle}
            className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-glow-sm transition-all duration-200 hover:brightness-110 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingForm ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : mode === 'register' ? (
              <>
                <UserPlus className="h-4 w-4 transition-transform group-hover:scale-110" />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Switcher Option underneath forms */}
      <div className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
        {mode === 'signin' ? (
          <span>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="font-bold text-teal-600 hover:underline dark:text-teal-400"
            >
              Create New Account
            </button>
          </span>
        ) : (
          <span>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="font-bold text-teal-600 hover:underline dark:text-teal-400"
            >
              Sign In
            </button>
          </span>
        )}
      </div>

      {/* Security Footer */}
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
      <div className="my-auto flex w-full justify-center py-8">
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="h-96 rounded-3xl bg-slate-100 animate-pulse dark:bg-slate-800" />}>
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
