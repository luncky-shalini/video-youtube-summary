'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LogOut, Sparkles, Youtube, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { UserProfile } from '@/lib/types';

interface NavLink {
  href: string;
  label: string;
}

export function AppShell({
  profile,
  links,
  children,
}: {
  profile: UserProfile;
  links: NavLink[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#0b0f19]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0b0f19]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 via-cyan-500 to-emerald-400 p-0.5 shadow-glow-sm transition-transform duration-300 group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-white">
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 text-base font-black tracking-tight text-slate-900 dark:text-white">
                Synapse<span className="bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">Tube</span>
              </span>
              <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 -mt-1">
                AI Knowledge Synthesizer
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-slate-100/60 p-1 dark:border-slate-800/70 dark:bg-slate-900/60">
            {links.map((l) => {
              const active =
                pathname === l.href ||
                (l.href !== '/dashboard' && l.href !== '/admin' && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-white text-teal-700 shadow-sm dark:bg-slate-800 dark:text-teal-300 dark:shadow-glow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions: ThemeToggle + Profile + Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 py-1 pl-1.5 pr-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <div className="relative">
                {profile.photo ? (
                  <Image
                    src={profile.photo}
                    alt={profile.name ?? 'avatar'}
                    width={30}
                    height={30}
                    className="rounded-full ring-2 ring-teal-500/30"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-teal-600 to-cyan-600 text-xs font-bold text-white">
                    {(profile.name ?? profile.email)[0]?.toUpperCase()}
                  </span>
                )}
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />
              </div>
              <div className="hidden text-left md:block">
                <p className="max-w-[8.5rem] truncate text-xs font-semibold leading-tight text-slate-900 dark:text-slate-100">
                  {profile.name ?? profile.email}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {profile.role === 'student' ? 'Member' : profile.role}
                  </p>
                </div>
              </div>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-500 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-red-900/50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
