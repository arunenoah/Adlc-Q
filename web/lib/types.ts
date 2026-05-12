export type CLIRegistration = {
  active: boolean;
  plan?: string;
  until?: string;
};

export type Stack = {
  frontend: string;
  backend: string;
  database: string;
};

export type Epic = {
  id: string;
  title: string;
  type: "feature" | "bug" | "api";
  brief?: string;
  graphImpact?: GraphImpact;
  subtaskKeys?: string[];
  dynamicImplTasks?: DynamicImplTask[];
  outputs?: Record<string, string>;
  taskStages?: Record<string, string>;
  handoffPaths?: Record<string, string>;
  completedAt?: string;       // ISO timestamp when user manually marked complete
  completedNote?: string;     // optional context (PR #, version, etc.)
};

export type DynamicImplTask = {
  id: string;
  title: string;
  role: string;
  files: string[];
  depends_on: string[];
};

export type GraphImpactNode = {
  id: string;
  label: string;
  file: string;
  location: string;
  matchScore: number;
};

export type GraphImpact = {
  keywords: string[];
  matchedNodes: GraphImpactNode[];
  touchedGodNodes: { name: string; edges: number }[];
  affectedFiles: string[];
  totalMatches: number;
};

export type Project = {
  id: string;
  name: string;
  pm: string;
  stack: Stack;
  stackLabel?: string;
  agentModels: Record<string, string>;
  epics: Epic[];
  workspacePath?: string;
  graphMeta?: ProjectGraphMeta;
  skills?: SkillMeta[];
  agents?: AgentMeta[];
  commands?: CommandMeta[];
};

export type SkillMeta = {
  id: string;
  name: string;
  description: string;
  path: string;
};

export type AgentMeta = {
  id: string;
  name: string;
  description: string;
  path: string;
  role?: string;
  skillIds: string[];
};

export type CommandMeta = {
  id: string;
  name: string;
  description: string;
  path: string;
};

export type ProjectGraphMeta = {
  nodes: number;
  edges: number;
  communities: number;
  files: number;
  godNodes: { name: string; edges: number }[];
  surprisingConnections: string[];
  suggestedQuestions: string[];
  reportDate?: string;
};

export type DiscoveredProject = {
  dirName: string;
  workspacePath: string;
  stackLabel: string;
  approxNodes: number;
  graphMeta: ProjectGraphMeta;
  skills: SkillMeta[];
  agents: AgentMeta[];
  commands: CommandMeta[];
};

export type Store = {
  projects: Project[];
  clis: Record<string, CLIRegistration>;
  version: number;
};
