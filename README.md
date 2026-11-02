# AI Learning Platform

An AI-powered learning platform: students sign in with Google, search any topic, and the app fetches the top 10 YouTube videos, extracts their transcripts, and uses AI to merge everything into one high-quality structured study document — with key concepts, examples, interview questions, a 10-question quiz, and practical exercises. Notes can be exported as a professionally formatted PDF.

## Features

- **Google OAuth** via Supabase Auth — accounts are created automatically on first sign-in.
- **Two roles** — `student` and `admin`, stored server-side and never trusted from the client.
- **Complete data isolation** — Postgres Row Level Security ensures students can only ever read/write rows where `user_id = auth.uid()`. Admin access runs exclusively through server-side code using the service-role key.
- **Admin dashboard** — all students, per-student search history, summaries, token usage, login history, PDF export history, most-searched-topics and token-usage charts.
- **YouTube integration** — top 10 videos per topic with title, thumbnail, channel, duration, views, and publish date.
- **AI study notes** — per-video digests (transcript-based, caption fallback) merged into one deduplicated document with Overview, Key Concepts, Detailed Explanation, Examples, Important Points, Interview Questions, Quiz (10 MCQs), Practical Exercises, and Resources.
- **PDF export** — client-side jsPDF rendering with student name, topic, date, and page numbers; every export is logged.
- **Token tracking** — prompt/completion/total tokens per search, visible to the student (own only) and admin (everyone).
- **Modern UI** — Next.js App Router, Tailwind CSS, dark/light mode, responsive, loading/progress states, Recharts.

## Tech stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres + Auth + RLS) · OpenAI API · YouTube Data API v3 · `youtube-transcript` · jsPDF · Recharts · Vercel

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql). This creates all tables, the auto-profile trigger, and every RLS policy.
3. **Authentication → Providers → Google**: enable Google. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth client ID, type "Web application") with:
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. **Authentication → URL Configuration**: set Site URL to your app URL and add `http://localhost:3000/auth/callback` (and your production `/auth/callback`) to the redirect allow-list.

### 2. API keys

- **AI provider** — the app tries providers in order and falls back automatically:
  1. **Groq** (`GROQ_API_KEY`, optional `GROQ_MODEL`, default `openai/gpt-oss-120b`) — free tier at console.groq.com, tried first.
  2. **OpenAI** (`OPENAI_API_KEY`, optional `OPENAI_MODEL`) — or any OpenAI-compatible endpoint via `OPENAI_BASE_URL` (e.g. Gemini: `https://generativelanguage.googleapis.com/v1beta/openai/`).

  At least one must be set.
- **YouTube Data API v3** — enable it in Google Cloud Console and create an API key (starts with `AIza`, not an OAuth client ID).

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in every value. `ADMIN_EMAILS` is a comma-separated list of Google emails that are promoted to admin on their next login. The service-role key must never be exposed to the browser.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with Google, and search a topic.

### 5. Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Add all environment variables from `.env.local`.
3. Update the Supabase URL Configuration redirect list with your production domain.
4. Note: a full search processes 10 videos through the AI and can take 1–3 minutes. `maxDuration = 300` is set on the search route; on the Vercel Hobby plan the function limit may be lower — reduce videos per search or upgrade if you hit timeouts.

## Security model

| Layer | Mechanism |
| --- | --- |
| Database | RLS on every table; students match `auth.uid()` only. `token_usage` and `login_history` are server-write-only. |
| Role integrity | A DB trigger blocks users from updating their own `role`; promotion happens only server-side via `ADMIN_EMAILS`. |
| Admin reads | Service-role client is imported with `server-only` and used solely behind `requireAdmin()` (server-side role check + redirect). |
| API | The search endpoint re-authenticates from cookies, validates input, and writes with the caller's own identity. |
| Sessions | Supabase SSR cookies, refreshed in middleware; `/dashboard` and `/admin` are gated there too. |

## Project structure

```
supabase/migrations/0001_schema.sql   # schema + triggers + RLS
src/
  middleware.ts                       # session refresh + route protection
  lib/
    supabase/{client,server,admin}.ts # browser / SSR / service-role clients
    auth.ts                           # getProfile, requireUser, requireAdmin
    youtube.ts                        # YouTube Data API v3 search + details
    transcript.ts                     # transcript/caption extraction
    ai.ts                             # per-video digest + combined notes, token counting
  app/
    login/                            # Google sign-in
    auth/callback, auth/signout       # OAuth code exchange, logout
    api/search/                       # orchestration: YouTube → transcripts → AI → DB
    dashboard/                        # student: home, history, notes/[id]
    admin/                            # admin: overview, students, students/[id]
  components/                         # AppShell, SearchBox, VideoCard, NotesPanel,
                                      # ExportPdfButton, StatCard, AdminCharts, ThemeToggle
```
