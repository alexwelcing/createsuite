/**
 * Effect Schema definitions for CreateSuite domain types.
 *
 * These provide runtime validation, encoding/decoding, and serve
 * as the single source of truth for data shapes — replacing the
 * plain interfaces in types.ts with schemas that validate at
 * boundaries (file reads, API responses, CLI input).
 */
import { Schema } from "effect";

// ── Enums as Schema literals ───────────────────────────────

export const TaskStatusSchema = Schema.Literal(
  "open",
  "in_progress",
  "completed",
  "blocked"
);
export type TaskStatus = typeof TaskStatusSchema.Type;

export const TaskPrioritySchema = Schema.Literal(
  "low",
  "medium",
  "high",
  "critical"
);
export type TaskPriority = typeof TaskPrioritySchema.Type;

export const AgentStatusSchema = Schema.Literal(
  "idle",
  "working",
  "offline",
  "error"
);
export type AgentStatus = typeof AgentStatusSchema.Type;

export const AgentRuntimeSchema = Schema.Literal("local", "fly");
export type AgentRuntime = typeof AgentRuntimeSchema.Type;

export const ConvoyStatusSchema = Schema.Literal(
  "active",
  "completed",
  "paused"
);
export type ConvoyStatus = typeof ConvoyStatusSchema.Type;

export const WorkflowTypeSchema = Schema.Literal(
  "simple",
  "complex",
  "team"
);
export type WorkflowType = typeof WorkflowTypeSchema.Type;

export const PipelinePhaseSchema = Schema.Literal(
  "cloning",
  "planning",
  "executing",
  "committing",
  "pr_creating",
  "completed",
  "failed"
);
export type PipelinePhase = typeof PipelinePhaseSchema.Type;

// ── Date helper ────────────────────────────────────────────

/** Accept Date objects or ISO strings, always decode to Date */
const DateFromSelf = Schema.Date;

const DateFromString = Schema.transform(
  Schema.String,
  Schema.DateFromSelf,
  {
    decode: (s) => new Date(s),
    encode: (d) => d.toISOString(),
  }
);

/** Flexibly accept Date | string, always produce Date */
export const FlexibleDate = Schema.Union(DateFromSelf, DateFromString);

// ── Core domain schemas ────────────────────────────────────

export const TaskSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
  status: TaskStatusSchema,
  assignedAgent: Schema.optional(Schema.String),
  createdAt: FlexibleDate,
  updatedAt: FlexibleDate,
  priority: TaskPrioritySchema,
  tags: Schema.Array(Schema.String),
});
export type Task = typeof TaskSchema.Type;

export const MessageSchema = Schema.Struct({
  id: Schema.String,
  from: Schema.String,
  to: Schema.String,
  subject: Schema.String,
  body: Schema.String,
  timestamp: FlexibleDate,
  read: Schema.Boolean,
});
export type Message = typeof MessageSchema.Type;

export const AgentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  status: AgentStatusSchema,
  currentTask: Schema.optional(Schema.String),
  terminalPid: Schema.optional(Schema.Number),
  runtime: Schema.optional(AgentRuntimeSchema),
  flyAppName: Schema.optional(Schema.String),
  mailbox: Schema.Array(MessageSchema),
  capabilities: Schema.Array(Schema.String),
  createdAt: FlexibleDate,
});
export type Agent = typeof AgentSchema.Type;

export const ConvoySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  tasks: Schema.Array(Schema.String),
  createdAt: FlexibleDate,
  status: ConvoyStatusSchema,
});
export type Convoy = typeof ConvoySchema.Type;

export const OAuthConfigSchema = Schema.Struct({
  clientId: Schema.optional(Schema.String),
  tokenPath: Schema.optional(Schema.String),
  scopes: Schema.Array(Schema.String),
});
export type OAuthConfig = typeof OAuthConfigSchema.Type;

export const WorkspaceConfigSchema = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  repository: Schema.optional(Schema.String),
  agents: Schema.Array(AgentSchema),
  oauthConfig: Schema.optional(OAuthConfigSchema),
});
export type WorkspaceConfig = typeof WorkspaceConfigSchema.Type;

export const RepoConfigSchema = Schema.Struct({
  url: Schema.String,
  owner: Schema.String,
  name: Schema.String,
  localPath: Schema.String,
  defaultBranch: Schema.String,
  clonedAt: FlexibleDate,
});
export type RepoConfig = typeof RepoConfigSchema.Type;

export const SkillCategorySchema = Schema.Struct({
  name: Schema.String,
  skills: Schema.Array(Schema.String),
  direction: Schema.String,
});
export type SkillCategory = typeof SkillCategorySchema.Type;

export const RouterResultSchema = Schema.Struct({
  recommended: WorkflowTypeSchema,
  confidence: Schema.Number,
  reasoning: Schema.String,
  suggestedSkills: Schema.Array(Schema.String),
  estimatedAgents: Schema.Number,
});
export type RouterResult = typeof RouterResultSchema.Type;

export const PipelineConfigSchema = Schema.Struct({
  repoUrl: Schema.String,
  goal: Schema.String,
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  githubToken: Schema.optional(Schema.String),
  maxAgents: Schema.optional(Schema.Number),
  dryRun: Schema.optional(Schema.Boolean),
});
export type PipelineConfig = typeof PipelineConfigSchema.Type;

export const PipelineStatusSchema = Schema.Struct({
  id: Schema.String,
  repoUrl: Schema.String,
  goal: Schema.String,
  phase: PipelinePhaseSchema,
  convoyId: Schema.optional(Schema.String),
  prUrl: Schema.optional(Schema.String),
  startedAt: FlexibleDate,
  completedAt: Schema.optional(FlexibleDate),
  error: Schema.optional(Schema.String),
});
export type PipelineStatus = typeof PipelineStatusSchema.Type;
