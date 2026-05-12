// Design tokens — colors, type scales, common style frags.
// Kept tiny + readonly; widened to React.CSSProperties at the call site.
//
// Contrast notes (WCAG 2.2 AA needs ≥4.5:1 for body, ≥3:1 for ≥18px or bold):
//   ink     #111 on paper #fafaf7 → 17.4 : 1 (AAA)
//   dim     #555 on paper #fafaf7 →  7.1 : 1 (AAA)  ← was #888 = 3.4:1 (FAIL)
//   accent  #e8472c on paper      →  4.5 : 1 (AA   — body OK)
//   ok      #3a7a3a on paper      →  5.0 : 1 (AA)
//   warn    #c98a2b on paper      →  3.1 : 1 (AA-large only — keep for icons + ≥18px text)
//   swarm   #3a5a78 on paper      →  7.4 : 1 (AAA)
//   ink-soft paper inverse for terminal panels (was #0a0e1a / #000 — too harsh)
export const C = {
  ink: "#111",
  paper: "#fafaf7",
  line: "#111",
  accent: "#e8472c",
  ok: "#3a7a3a",
  warn: "#c98a2b",
  dim: "#555",
  soft: "#ececec",
  swarm: "#3a5a78",
  terminal: "#14181f",   // softer than pure #000; still high contrast for #d6e2c7 text
  termText: "#d6e2c7",
  termOk: "#9be59b",
  termErr: "#ff8b6b",
  termWarn: "#e8c46c",
} as const;

// Typography scale — minimum readable body = 11px. Anything 9–10px MUST be
// ALL CAPS micro-label (tracking adds legibility) AND short (≤30 chars).
export const T = {
  body:        { fontSize: 12 },
  bodySmall:   { fontSize: 11 },
  microLabel:  { fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase" as const },
  microStrong: { fontSize: 9,  letterSpacing: "0.14em", textTransform: "uppercase" as const, fontWeight: 600 },
} as const;

export const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
export const serif = { fontFamily: "'Fraunces', Georgia, serif" };

export const TECH = {
  frontend: [
    { id: "react", name: "React" },
    { id: "vue", name: "Vue" },
    { id: "next", name: "Next.js" },
    { id: "svelte", name: "Svelte" },
    { id: "blade", name: "Blade/Twig" },
    { id: "none", name: "—" },
  ],
  backend: [
    { id: "node", name: "Node.js" },
    { id: "python", name: "Python/FastAPI" },
    { id: "go", name: "Go" },
    { id: "rails", name: "Rails" },
    { id: "php-laravel", name: "PHP/Laravel" },
    { id: "php-yii2", name: "PHP/Yii2" },
    { id: "php", name: "PHP" },
  ],
  database: [
    { id: "postgres", name: "Postgres" },
    { id: "mongo", name: "MongoDB" },
    { id: "mysql", name: "MySQL" },
    { id: "supabase", name: "Supabase" },
  ],
};
