// Loose stack inference: stackLabel string from workspace scanner → picker
// shape used by Project.stack ({frontend, backend, database}).
// SRP: this is a one-function module. Kept separate from theme.ts because
// it concerns project metadata, not visual design tokens.

export type StackPick = { frontend: string; backend: string; database: string };

export const stackFromLabel = (label: string): StackPick => {
  const l = (label || "").toLowerCase();
  const stack: StackPick = { frontend: "react", backend: "node", database: "mysql" };

  if (l.includes("yii"))          { stack.backend = "php-yii2";    stack.frontend = "blade"; }
  else if (l.includes("laravel")) { stack.backend = "php-laravel"; stack.frontend = "blade"; }
  else if (l.includes("php"))     { stack.backend = "php";         stack.frontend = "blade"; }

  if (l.includes("next"))                                                    stack.frontend = "next";
  else if (l.includes("react native"))                                       stack.frontend = "react";
  else if (l.includes("typescript/react") || l.includes("react"))            stack.frontend = "react";
  else if (l.includes("vue"))                                                stack.frontend = "vue";
  else if (l.includes("svelte"))                                             stack.frontend = "svelte";

  if (l.includes("python") || l.includes("fastapi"))                         stack.backend = "python";
  if (l.includes(" go") || l.startsWith("go"))                               stack.backend = "go";
  if (l.includes("rails") || l.includes("ruby"))                             stack.backend = "rails";

  if (l.includes("postgres"))                                                stack.database = "postgres";
  if (l.includes("mongo"))                                                   stack.database = "mongo";
  if (l.includes("supabase"))                                                stack.database = "supabase";

  return stack;
};
