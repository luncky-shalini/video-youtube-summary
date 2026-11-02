'use client';

import { useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle, Award, Sparkles } from 'lucide-react';
import type { QuizQuestion } from '@/lib/markdown';

export function QuizPlayer({ questions }: { questions: QuizQuestion[] }) {
  const [picked, setPicked] = useState<Record<number, string>>({});

  const answered = Object.keys(picked).length;
  const score = questions.reduce(
    (s, q) => s + (picked[q.number] && picked[q.number] === q.answer ? 1 : 0),
    0,
  );
  const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const progressPercent = questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Sticky Progress & Score Header */}
      <div className="sticky top-20 z-10 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
              <Award className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Live Quiz Score
              </p>
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                <span className="text-teal-600 dark:text-teal-400">{score}</span> / {questions.length} Correct
                <span className="ml-2 text-xs font-medium text-slate-400">({percent}%)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {answered} of {questions.length} completed
            </span>
            {answered > 0 && (
              <button
                onClick={() => setPicked({})}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset Quiz
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Cards */}
      {questions.map((q, qi) => {
        const chosen = picked[q.number];
        const isAnswered = Boolean(chosen);
        return (
          <div
            key={q.number}
            className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:p-7"
          >
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 text-xs font-extrabold text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/30">
                {qi + 1}
              </span>
              <p className="font-semibold text-slate-900 dark:text-slate-100 leading-relaxed text-base">
                {q.question}
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {q.options.map((opt) => {
                const isChosen = chosen === opt.key;
                const isCorrect = q.answer === opt.key;
                let style =
                  'border-slate-200/90 bg-slate-50/50 hover:border-teal-500/40 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-teal-500/40 dark:hover:bg-slate-900';

                if (isAnswered) {
                  if (isCorrect) {
                    style =
                      'border-emerald-500 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20';
                  } else if (isChosen) {
                    style =
                      'border-rose-500 bg-rose-50/90 text-rose-900 dark:border-rose-500/60 dark:bg-rose-950/40 dark:text-rose-300 ring-2 ring-rose-500/20';
                  } else {
                    style = 'border-slate-200/60 opacity-50 dark:border-slate-800';
                  }
                }

                return (
                  <button
                    key={opt.key}
                    disabled={isAnswered}
                    onClick={() => setPicked((p) => ({ ...p, [q.number]: opt.key }))}
                    className={`flex items-start gap-3 rounded-2xl border p-4 text-left text-sm font-medium transition-all duration-200 disabled:cursor-default ${style}`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-bold text-xs uppercase bg-white/80 shadow-2xs dark:bg-slate-800">
                      {opt.key}
                    </span>
                    <span className="flex-1 leading-snug">{opt.text}</span>
                    {isAnswered && isCorrect && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {isAnswered && isChosen && !isCorrect && (
                      <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {isAnswered && (
              <div
                className={`mt-4 rounded-xl p-3 text-xs font-semibold flex items-center gap-2 ${
                  chosen === q.answer
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                }`}
              >
                {chosen === q.answer ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Correct answer! Excellent knowledge retention.
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> Incorrect. The correct answer is option{' '}
                    <span className="font-bold underline">{q.answer}</span>.
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
