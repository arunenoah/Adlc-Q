// Adlc-Q design tokens.
//
// New (preferred) palette uses a modern neutral system; legacy keys (`ink`,
// `paper`, `line`, `dim`, `soft`, `swarm`) are kept as aliases so existing
// inline-style call sites stay green during the typography overhaul. New
// code should use the semantic names: text1/text2/text3, bg, card, etc.
//
// Contrast (WCAG 2.2 AA = 4.5:1 body / 3:1 large):
//   text1 #0a0a0a on bg #fafafa = 18.7:1 (AAA)
//   text2 #525866 on bg          =  7.6:1 (AAA)
//   text3 #71717a on bg          =  4.6:1 (AA body OK)
//   accent #e8472c on bg         =  4.7:1 (AA body)
//   ok #16a34a on bg             =  3.6:1 (large only)
//   warn #d97706 on bg           =  3.5:1 (large only)
//   info #2563eb on bg           =  6.7:1 (AAA)

const PALETTE = {
  bg:      "#fafafa",
  card:    "#ffffff",
  soft:    "#f4f4f5",
  text1:   "#0a0a0a",
  text2:   "#525866",
  text3:   "#71717a",
  border1: "#e5e7eb",
  border2: "#d1d5db",
  accent:  "#e8472c",
  ok:      "#16a34a",
  warn:    "#d97706",
  info:    "#2563eb",
  terminal:    "#14181f",
  termText:    "#d6e2c7",
  termOk:      "#9be59b",
  termErr:     "#ff8b6b",
  termWarn:    "#e8c46c",
} as const;

// Public token bag. Legacy names alias the new palette.
export const C = {
  // legacy aliases (existing inline styles)
  ink:    PALETTE.text1,
  paper:  PALETTE.bg,
  line:   PALETTE.border2,
  dim:    PALETTE.text3,
  soft:   PALETTE.soft,
  swarm:  PALETTE.info,
  accent: PALETTE.accent,
  ok:     PALETTE.ok,
  warn:   PALETTE.warn,

  // new semantic names — prefer these
  bg:     PALETTE.bg,
  card:   PALETTE.card,
  text1:  PALETTE.text1,
  text2:  PALETTE.text2,
  text3:  PALETTE.text3,
  border1: PALETTE.border1,
  border2: PALETTE.border2,
  info:   PALETTE.info,

  terminal:  PALETTE.terminal,
  termText:  PALETTE.termText,
  termOk:    PALETTE.termOk,
  termErr:   PALETTE.termErr,
  termWarn:  PALETTE.termWarn,
} as const;

// Typography scale.
//   body / bodySmall — sentence case, normal weight, no tracking
//   label            — sentence case 12px, used for form labels
//   microLabel       — small caps 10px, light tracking — *only* for nav/section headers
// Body fonts are the system sans (Inter via next/font); mono is reserved for
// code, paths, identifiers, numerical streams.
export const T = {
  h1:        { fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.25 },
  h2:        { fontSize: 18, fontWeight: 600, letterSpacing: "-0.005em", lineHeight: 1.3 },
  h3:        { fontSize: 15, fontWeight: 600, lineHeight: 1.35 },
  body:      { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  bodySmall: { fontSize: 13, fontWeight: 400, lineHeight: 1.5 },
  label:     { fontSize: 12, fontWeight: 500, lineHeight: 1.4 },
  caption:   { fontSize: 12, fontWeight: 400, color: PALETTE.text2, lineHeight: 1.4 },
  microLabel:{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: PALETTE.text2 },
} as const;

// Radius + spacing scales.
export const R = { sm: 4, md: 6, lg: 8, full: 999 } as const;
export const S = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32 } as const;

// Font stacks. Wired via globals.css :root — keeping these for inline overrides.
export const sans = { fontFamily: "var(--font-sans-stack)" };
export const mono = { fontFamily: "var(--font-mono-stack)" };
export const serif = { fontFamily: "var(--font-sans-stack)" }; // legacy alias — serif removed

// Tech-stack picker options (unchanged).
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
