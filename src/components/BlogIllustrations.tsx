/**
 * Themed inline-SVG illustrations for the landing blog cards. Self-contained
 * (no external image hosts), responsive, and drawn in the site's palette.
 */

function Frame({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 400 180"
      className="h-40 w-full"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fdfa" />
          <stop offset="100%" stopColor="#ecfeff" />
        </linearGradient>
        <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="400" height="180" fill={`url(#${id}-bg)`} />
      <circle cx="360" cy="20" r="46" fill="#99f6e4" opacity="0.45" />
      <circle cx="30" cy="165" r="38" fill="#a5f3fc" opacity="0.5" />
      {children}
    </svg>
  );
}

/** Card 1 — studying: laptop with code, books, mug, plant. */
export function StudyIllustration() {
  return (
    <Frame id="study">
      {/* desk */}
      <rect x="40" y="132" width="320" height="10" rx="5" fill="#5eead4" />
      {/* laptop */}
      <rect x="150" y="62" width="120" height="72" rx="8" fill="url(#study-accent)" />
      <rect x="158" y="70" width="104" height="56" rx="4" fill="#ffffff" />
      <text x="176" y="104" fontFamily="monospace" fontSize="26" fontWeight="bold" fill="#0d9488">
        {'</>'}
      </text>
      <rect x="140" y="132" width="140" height="7" rx="3.5" fill="#2dd4bf" />
      {/* book stack */}
      <rect x="52" y="112" width="70" height="12" rx="3" fill="#0d9488" />
      <rect x="58" y="98" width="70" height="12" rx="3" fill="#14b8a6" />
      <rect x="54" y="84" width="70" height="12" rx="3" fill="#06b6d4" />
      {/* mug */}
      <rect x="300" y="106" width="26" height="26" rx="4" fill="#0d9488" />
      <path d="M326 112 h8 a6 6 0 0 1 0 14 h-8" fill="none" stroke="#0d9488" strokeWidth="4" />
      <path d="M306 98 q3 -6 0 -10 M316 98 q3 -6 0 -10" stroke="#5eead4" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* lightbulb idea */}
      <circle cx="210" cy="34" r="13" fill="#fbbf24" />
      <rect x="205" y="46" width="10" height="6" rx="2" fill="#f59e0b" />
      <path d="M210 10 v8 M188 18 l6 6 M232 18 l-6 6" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

/** Card 2 — quiz: answer sheet with options, pencil, question bubble. */
export function QuizIllustration() {
  return (
    <Frame id="quiz">
      {/* sheet */}
      <rect x="120" y="22" width="150" height="140" rx="10" fill="#ffffff" stroke="#99f6e4" strokeWidth="2" />
      <rect x="136" y="38" width="80" height="9" rx="4.5" fill="#5eead4" />
      {/* options */}
      {[
        { y: 62, checked: false },
        { y: 88, checked: true },
        { y: 114, checked: false },
        { y: 140, checked: false },
      ].map((o, i) => (
        <g key={o.y}>
          <circle
            cx="146"
            cy={o.y}
            r="8"
            fill={o.checked ? '#10b981' : '#ffffff'}
            stroke={o.checked ? '#10b981' : '#5eead4'}
            strokeWidth="2"
          />
          {o.checked && (
            <path d="M142 88 l3 4 l6 -7" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}
          <text x="141.5" y={o.y + 4} fontSize="10" fontWeight="bold" fill={o.checked ? '#ffffff' : '#0d9488'} opacity={o.checked ? 0 : 1}>
            {String.fromCharCode(65 + i)}
          </text>
          <rect x="162" y={o.y - 5} width={o.checked ? 92 : 78} height="9" rx="4.5" fill={o.checked ? '#a7f3d0' : '#ccfbf1'} />
        </g>
      ))}
      {/* pencil */}
      <g transform="rotate(35 310 110)">
        <rect x="296" y="60" width="16" height="80" rx="3" fill="url(#quiz-accent)" />
        <polygon points="296,140 312,140 304,158" fill="#fbbf24" />
        <polygon points="301,151 307,151 304,158" fill="#334155" />
        <rect x="296" y="54" width="16" height="8" rx="3" fill="#f472b6" />
      </g>
      {/* question bubble */}
      <circle cx="72" cy="52" r="24" fill="url(#quiz-accent)" />
      <text x="64" y="63" fontSize="30" fontWeight="bold" fill="#ffffff">?</text>
      <polygon points="62,72 78,72 66,88" fill="#0d9488" />
    </Frame>
  );
}

/** Card 3 — synthesis: several videos flowing into one AI document. */
export function SynthesisIllustration() {
  return (
    <Frame id="synth">
      {/* video tiles */}
      {[26, 72, 118].map((y, i) => (
        <g key={y}>
          <rect x="36" y={y} width="64" height="40" rx="6" fill="#ffffff" stroke="#99f6e4" strokeWidth="2" />
          <rect x="36" y={y} width="64" height="40" rx="6" fill="#0d9488" opacity={0.12 + i * 0.06} />
          <polygon points={`${60},${y + 12} ${60},${y + 28} ${76},${y + 20}`} fill="#ef4444" />
        </g>
      ))}
      {/* flow lines */}
      {[46, 92, 138].map((y) => (
        <path
          key={y}
          d={`M102 ${y} C 150 ${y}, 150 92, 196 92`}
          fill="none"
          stroke="#5eead4"
          strokeWidth="3"
          strokeDasharray="6 6"
          strokeLinecap="round"
        />
      ))}
      {/* AI node */}
      <circle cx="216" cy="92" r="24" fill="url(#synth-accent)" />
      <text x="203" y="98" fontSize="15" fontWeight="bold" fill="#ffffff">AI</text>
      <circle cx="216" cy="92" r="32" fill="none" stroke="#06b6d4" strokeWidth="2" opacity="0.35" />
      {/* result document */}
      <path d="M262 92 h28" stroke="#5eead4" strokeWidth="3" strokeLinecap="round" />
      <rect x="294" y="38" width="76" height="108" rx="10" fill="#ffffff" stroke="#99f6e4" strokeWidth="2" />
      <rect x="306" y="54" width="42" height="9" rx="4.5" fill="url(#synth-accent)" />
      {[72, 88, 104, 120].map((y) => (
        <rect key={y} x="306" y={y} width="52" height="7" rx="3.5" fill="#ccfbf1" />
      ))}
      <circle cx="356" cy="132" r="10" fill="#10b981" />
      <path d="M351 132 l4 4 l7 -8" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </Frame>
  );
}
