import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Award,
  Bot,
  CheckCircle2,
  Clock,
  Compass,
  FileDown,
  FileText,
  Languages,
  Layers,
  ListChecks,
  Mail,
  MessageSquareText,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  Users,
  Wand2,
  Youtube,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ContactForm } from '@/components/ContactForm';
import {
  StudyIllustration,
  QuizIllustration,
  SynthesisIllustration,
} from '@/components/BlogIllustrations';

const NAV_LINKS = [
  { href: '#top', label: 'Home' },
  { href: '#how-it-works', label: 'Workflow' },
  { href: '#features', label: 'Features' },
  { href: '#insights', label: 'Insights' },
  { href: '#contact', label: 'Contact' },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);

  return (
    <div id="top" className="min-h-screen bg-slate-50/70 text-slate-900 selection:bg-teal-500/20 selection:text-teal-900 dark:bg-[#0b0f19] dark:text-slate-100 dark:selection:bg-teal-500/30">
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0b0f19]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="#top" className="flex items-center gap-2.5 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 via-cyan-500 to-emerald-400 p-0.5 shadow-glow-sm transition-transform duration-300 group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-white">
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>
            </div>
            <span className="text-base font-black tracking-tight sm:text-lg">
              Synapse<span className="bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">Tube</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex rounded-full border border-slate-200/60 bg-slate-100/60 p-1 dark:border-slate-800/70 dark:bg-slate-900/60">
            {NAV_LINKS.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  i === 0
                    ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-800 dark:text-teal-300'
                    : 'text-slate-600 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300'
                }`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="group relative flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:from-teal-500 hover:to-cyan-500 hover:shadow-glow-sm"
            >
              <span>Started Here &rarr;</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero & Introduction ────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:pt-12">
        {/* Ambient lighting */}
        <div className="pointer-events-none absolute left-1/2 -top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-10 lg:p-12">
          {/* Hero Header */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-50/70 px-3.5 py-1 text-xs font-bold text-teal-700 backdrop-blur dark:bg-teal-950/40 dark:text-teal-300">
              <Sparkles className="h-3.5 w-3.5 text-teal-500" />
              <span>Autonomous Video Transcription & Multilingual Translation</span>
            </div>

            <h1 className="mt-5 text-3xl font-black leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl text-slate-900 dark:text-white">
              Video Upload, Subtitles &{' '}
              <span className="bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400 bg-clip-text text-transparent">
                Instant AI Translation
              </span>
            </h1>

            <p className="mt-3 text-sm sm:text-base font-medium text-slate-600 dark:text-slate-300">
              Upload any local video or import YouTube content. Enjoy synchronized captions,
              seamless translation into Telugu, Hindi, Chinese, Korean, English, and full CC toggle controls.
            </p>
          </div>

          {/* Quick Stats Bar */}
          <div className="mt-12 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50 sm:grid-cols-4">
            {[
              { icon: Upload, color: 'text-teal-500', value: 'Instant', label: 'Local Video Upload' },
              { icon: Languages, color: 'text-cyan-500', value: 'Telugu & Hindi', label: 'Multilingual Subtitles' },
              { icon: Clock, color: 'text-emerald-500', value: '100%', label: 'Synced Timestamps' },
              { icon: ShieldCheck, color: 'text-blue-500', value: 'CC Controls', label: 'Instant ON / OFF Toggle' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-center gap-3 text-center sm:text-left">
                <s.icon className={`h-6 w-6 ${s.color} shrink-0`} />
                <div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{s.value}</p>
                  <p className="text-[11px] font-semibold text-slate-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow (How it Works) ────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            Intuitive Experience
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl text-slate-900 dark:text-white">
            The Complete Subtitle Workflow
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-500 dark:text-slate-400">
            From raw video file to synchronized multilingual subtitles in three quick steps.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Upload Supported Video',
              desc: 'Click Upload Video in your workspace to select any MP4, WebM, OGG, MOV, or MKV file. Instant validation ensures invalid formats are rejected cleanly.',
              icon: Upload,
              accent: 'from-teal-500 to-cyan-500',
            },
            {
              step: '02',
              title: 'Choose Target Language',
              desc: 'Select Telugu, Hindi, Chinese, Korean, English, or other supported languages from the dropdown. Then click Translate to convert the transcript.',
              icon: Languages,
              accent: 'from-cyan-500 to-blue-500',
            },
            {
              step: '03',
              title: 'Play & Toggle Closed Captions',
              desc: 'Subtitles stay synchronized across playback, pause, and seeking. Toggle CC ON or OFF anytime with active translations fully preserved.',
              icon: Award,
              accent: 'from-emerald-500 to-teal-500',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow-sm dark:border-slate-800 dark:bg-slate-900/80"
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr ${item.accent} text-white shadow-xs`}>
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-2xl font-black text-slate-200 dark:text-slate-800 group-hover:text-teal-500/30 transition-colors">
                  {item.step}
                </span>
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 bg-slate-100/50 py-20 dark:bg-slate-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Powerful Capabilities
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl text-slate-900 dark:text-white">
              Features Built for Multilingual Video Learning
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-500 dark:text-slate-400">
              Complete video transcription, translation, and study notes in one platform.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Upload,
                title: 'Local File Validation & Upload',
                desc: 'Safely select video files from your computer. Validates supported containers (MP4, WebM, OGG, MOV, MKV) with clear feedback.',
              },
              {
                icon: Languages,
                title: 'Telugu, Hindi & Global Translations',
                desc: 'Translate transcripts into Telugu, Hindi, Korean, Chinese, and European languages with contextual accuracy and natural phrasing.',
              },
              {
                icon: Clock,
                title: 'Frame-Accurate Subtitle Sync',
                desc: 'Subtitles dynamically synchronize with video timestamps during continuous playback, pausing, resuming, and seeking.',
              },
              {
                icon: ListChecks,
                title: 'CC ON/OFF Subtitle Toggling',
                desc: 'Turn subtitles ON or OFF anytime while video continues playing. Translations remain cached and ready in memory.',
              },
              {
                icon: Youtube,
                title: 'YouTube URL Import Compatibility',
                desc: 'Paste any public YouTube URL to load video and caption tracks directly into the same player and subtitle controls.',
              },
              {
                icon: FileText,
                title: 'AI Video Study Notes & Synopsis',
                desc: 'Generate comprehensive study notes, structured concepts, and downloadable PDF study guides directly from your videos.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow-sm dark:border-slate-800 dark:bg-slate-900/80"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-500 group-hover:text-white dark:bg-teal-950/60 dark:text-teal-400">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-base font-bold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Insights / Blog ────────────────────────────────────────────── */}
      <section id="insights" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            Research & Methodology
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl text-slate-900 dark:text-white">
            Latest Learning Insights
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {[
            {
              tag: 'Study Strategy',
              title: 'How to learn any complex tech stack in 48 hours',
              blurb: 'A tactical blueprint for condensing hours of video lectures into focused, deliberate study sessions.',
              art: <StudyIllustration />,
            },
            {
              tag: 'Multilingual Learning',
              title: 'Accelerating comprehension with native-language subtitles',
              blurb: 'How synchronized captions in regional languages like Telugu and Hindi boost understanding of complex subjects.',
              art: <QuizIllustration />,
            },
            {
              tag: 'Cognitive Science',
              title: 'Dual-track processing: The power of synchronized captions',
              blurb: 'Aligning real-time video audio with synchronized visual text reinforces memory retention and concept clarity.',
              art: <SynthesisIllustration />,
            },
          ].map((b) => (
            <article
              key={b.title}
              className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow-sm dark:border-slate-800 dark:bg-slate-900/80"
            >
              {b.art}
              <div className="p-6">
                <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  {b.tag}
                </span>
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white leading-snug">
                  {b.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {b.blurb}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Contact ────────────────────────────────────────────────────── */}
      <section id="contact" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 p-8 sm:p-12 text-white shadow-xl">
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="relative grid items-start gap-10 lg:grid-cols-2">
            <div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-teal-200 backdrop-blur">
                Get in Touch
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl text-white">
                Have questions or feedback?
              </h2>
              <p className="mt-3 text-sm text-teal-100/90 leading-relaxed max-w-lg">
                We are actively refining our video transcription and multilingual translation pipelines.
                Share your feedback, report an issue, or suggest features.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <a
                  href="mailto:contact@synapsetube.io"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-teal-200 hover:text-white transition"
                >
                  <Mail className="h-4 w-4" /> contact@synapsetube.io
                </a>
              </div>

              <div className="mt-8">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-teal-900 shadow-md transition hover:bg-teal-50"
                >
                  <span>Started Here &rarr;</span>
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
              <h3 className="mb-4 text-base font-bold text-white">Send us a direct message</h3>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/80 py-10 dark:border-slate-800/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              SynapseTube &copy; {new Date().getFullYear()} &bull; AI Video Subtitles & Synthesizer
            </span>
          </div>

          <nav className="flex flex-wrap gap-5">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-xs font-semibold text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 transition"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
