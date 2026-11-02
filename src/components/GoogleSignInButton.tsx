'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
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

interface GoogleSignInButtonProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  next?: string;
}

export function GoogleSignInButton({
  label = 'Continue with Google',
  size = 'md',
  className = '',
  next = '/dashboard',
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
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
      console.error('Google sign in error:', err);
      setLoading(false);
    }
  }

  let sizeStyles = 'px-5 py-2.5 text-sm';
  let iconSize = 'h-5 w-5';

  if (size === 'sm') {
    sizeStyles = 'px-4 py-1.5 text-xs';
    iconSize = 'h-4 w-4';
  } else if (size === 'lg') {
    sizeStyles = 'px-8 py-4 text-base sm:text-lg';
    iconSize = 'h-5 w-5 sm:h-6 sm:w-6';
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={loading}
      className={`group relative inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-800 shadow-sm transition-all duration-200 hover:border-teal-500/50 hover:bg-slate-50 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-teal-500/50 dark:hover:bg-slate-800 ${sizeStyles} ${className}`}
    >
      {loading ? (
        <Loader2 className={`${iconSize} animate-spin text-teal-600`} />
      ) : (
        <GoogleIcon className={iconSize} />
      )}
      <span>{label}</span>
    </button>
  );
}

