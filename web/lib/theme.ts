// Design tokens — colors, type scales, common style frags.
// Kept tiny + readonly; widened to React.CSSProperties at the call site.
export const C = {
  ink: "#111",
  paper: "#fafaf7",
  line: "#111",
  accent: "#e8472c",
  ok: "#3a7a3a",
  warn: "#c98a2b",
  dim: "#888",
  soft: "#ececec",
  swarm: "#3a5a78",
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
