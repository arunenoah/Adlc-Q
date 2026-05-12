// Agent role registry + stage list + per-epic-type subtask templates.
// SRP: this module owns the workflow shape only — no UI, no prompts, no
// runtime. Prompts live in lib/prompts.ts, runtime in lib/runner.ts.

export type AgentRole = {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  recommend: string;   // recommended model variant id from lib/models.ts
};

export type Stage = { id: string; label: string };

export type SubtaskTemplate = {
  key: string;
  title: string;
  agent: string;
};

export const AGENTS: AgentRole[] = [
  { id: "lead",   name: "Tech Lead",          emoji: "★", desc: "Scope, architecture, approach",                       recommend: "claude-opus-4-7" },
  { id: "writer", name: "Tech Writer",        emoji: "✎", desc: "Requirement spec, drift docs",                        recommend: "claude-sonnet-4-6" },
  { id: "ux",     name: "UX Architect",       emoji: "✦", desc: "Wireframes & flows",                                  recommend: "claude-sonnet-4-6" },
  { id: "secpre", name: "Security Pre-Check", emoji: "🛡", desc: "Threat model + required controls (BEFORE impl)",      recommend: "claude-sonnet-4-6" },
  { id: "fe",     name: "Frontend Dev",       emoji: "◐", desc: "Builds UI",                                           recommend: "claude-sonnet-4-6" },
  { id: "be",     name: "Backend Dev",        emoji: "◑", desc: "APIs & logic",                                        recommend: "claude-sonnet-4-6" },
  { id: "db",     name: "DB Engineer",        emoji: "▣", desc: "Schema & queries",                                    recommend: "claude-sonnet-4-6" },
  { id: "qa",     name: "QA Bot",             emoji: "◆", desc: "Tests & edge cases",                                  recommend: "claude-haiku-4-5-20251001" },
  { id: "rev",    name: "Code Reviewer",      emoji: "◇", desc: "Deep PR review",                                      recommend: "claude-opus-4-7" },
  { id: "sec",    name: "Security Reviewer",  emoji: "⚿", desc: "Diff audit + post-impl threat verify",                recommend: "claude-sonnet-4-6" },
  { id: "dev",    name: "DevOps",             emoji: "▲", desc: "Ship & monitor",                                      recommend: "claude-haiku-4-5-20251001" },
];

export const STAGES: Stage[] = [
  { id: "backlog",  label: "Backlog" },
  { id: "queue",    label: "In Queue" },
  { id: "progress", label: "In Progress" },
  { id: "unit",     label: "Unit Test" },
  { id: "review",   label: "Code Review" },
  { id: "sec",      label: "Security" },
  { id: "qa",       label: "QA" },
  { id: "done",     label: "Done" },
];

export const SUBTASK_TEMPLATES: Record<string, SubtaskTemplate[]> = {
  feature: [
    { key: "scope",       title: "Define scope & approach",                              agent: "lead" },
    { key: "spec",        title: "Write requirement spec",                               agent: "writer" },
    { key: "secpre",      title: "Security pre-check (threat model + required controls)", agent: "secpre" },
    { key: "impl-be",     title: "Implement backend",                                    agent: "be" },
    { key: "impl-fe",     title: "Implement frontend",                                   agent: "fe" },
    { key: "review",      title: "Code review",                                          agent: "rev" },
    { key: "security",    title: "Security post-check (diff audit)",                     agent: "sec" },
    { key: "qa-evidence", title: "QA: crawl endpoints, run tests, capture evidence",     agent: "qa" },
    { key: "drift",       title: "Drift review: verify scope items complete",            agent: "lead" },
    { key: "commit",      title: "Commit",                                               agent: "dev" },
  ],
  bug: [
    { key: "scope",       title: "Define scope & reproduction",                          agent: "lead" },
    { key: "spec",        title: "Write fix spec",                                       agent: "writer" },
    { key: "secpre",      title: "Security pre-check (threat model + required controls)", agent: "secpre" },
    { key: "fix",         title: "Fix root cause",                                       agent: "be" },
    { key: "review",      title: "Code review",                                          agent: "rev" },
    { key: "security",    title: "Security post-check (diff audit)",                     agent: "sec" },
    { key: "qa-evidence", title: "QA: regression test + evidence",                       agent: "qa" },
    { key: "drift",       title: "Drift review: verify scope items complete",            agent: "lead" },
    { key: "commit",      title: "Commit",                                               agent: "dev" },
  ],
  api: [
    { key: "scope",       title: "Define scope & approach",                              agent: "lead" },
    { key: "spec",        title: "Write API spec",                                       agent: "writer" },
    { key: "secpre",      title: "Security pre-check (threat model + required controls)", agent: "secpre" },
    { key: "impl-be",     title: "Implement endpoint",                                   agent: "be" },
    { key: "db",          title: "Add DB schema",                                        agent: "db" },
    { key: "review",      title: "Code review",                                          agent: "rev" },
    { key: "security",    title: "Security post-check (diff audit)",                     agent: "sec" },
    { key: "qa-evidence", title: "QA: contract tests + evidence",                        agent: "qa" },
    { key: "drift",       title: "Drift review: verify scope items complete",            agent: "lead" },
    { key: "commit",      title: "Commit",                                               agent: "dev" },
  ],
};

// Build the default {agentId → recommended-variant} mapping. Derived from
// AGENTS so adding a new role only touches one file.
export const defaultAgentModels = (): Record<string, string> => {
  const m: Record<string, string> = {};
  AGENTS.forEach((a) => { m[a.id] = a.recommend; });
  return m;
};
