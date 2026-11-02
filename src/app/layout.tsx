import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import './globals.css';

export const metadata: Metadata = {
  title: 'SynapseTube — Video Upload, YouTube Subtitles & Multilingual AI Translation',
  description:
    'Synchronized multilingual video subtitles, instant translations into Telugu, Hindi, Chinese, Korean, English, and study notes for uploaded videos and YouTube.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-teal-500/20 selection:text-teal-900 dark:bg-[#0b0f19] dark:text-slate-100 dark:selection:bg-teal-500/30 dark:selection:text-teal-200">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
