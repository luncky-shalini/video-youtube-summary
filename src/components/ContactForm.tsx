'use client';

import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';

const SUPPORT_EMAIL = 'contact@synapsetube.io';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`[SynapseTube Inquiry] Message from ${name || 'User'}`);
    const body = encodeURIComponent(`${message}\n\n— From: ${name} (${email})`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  const inputCls =
    'w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm text-white placeholder-teal-100/60 outline-none transition focus:border-teal-300 focus:bg-white/15';

  return (
    <form onSubmit={submit} className="space-y-3.5 text-left">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          required
          maxLength={80}
          className={inputCls}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          required
          maxLength={120}
          className={inputCls}
        />
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="How can we help you or what feature would you like to see?"
        required
        rows={4}
        maxLength={2000}
        className={`${inputCls} resize-none`}
      />
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-teal-800 shadow-md transition hover:bg-teal-50 sm:w-auto"
      >
        <Send className="h-4 w-4" /> Send Message
      </button>

      {submitted && (
        <p className="flex items-center gap-1.5 text-xs text-teal-100 mt-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Opening your default mail client...
        </p>
      )}
    </form>
  );
}
