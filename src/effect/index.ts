/**
 * CreateSuite Effect Module — Barrel Export
 *
 * This is the public API for the Effect-based implementation.
 * Import from "src/effect" to use typed services with dependency
 * injection, schema-validated data, and typed error channels.
 *
 * Migration guide:
 *   Old:  const tm = new TaskManager(cwd); await tm.createTask(...)
 *   New:  pipe(TaskService, Effect.flatMap(s => s.createTask(...)))
 *         |> Effect.provide(AppLayer(cwd))
 *         |> Effect.runPromise
 */

// ── Schemas (runtime-validated types) ──────────────────────
export {
  // Enum-like schemas
  TaskStatusSchema,
  TaskPrioritySchema,
  AgentStatusSchema,
  AgentRuntimeSchema,
  ConvoyStatusSchema,
  WorkflowTypeSchema,
  PipelinePhaseSchema,
  // Struct schemas
  TaskSchema,
  AgentSchema,
  ConvoySchema,
  MessageSchema,
  WorkspaceConfigSchema,
  OAuthConfigSchema,
  RepoConfigSchema,
  SkillCategorySchema,
  RouterResultSchema,
  PipelineConfigSchema,
  PipelineStatusSchema,
  // Type aliases
  type Task,
  type Agent,
  type Convoy,
  type WorkspaceConfig,
  type RepoConfig,
  type RouterResult,
  type PipelineConfig,
  type PipelineStatus,
  type TaskStatus,
  type TaskPriority,
  type AgentStatus,
  type AgentRuntime,
  type ConvoyStatus,
  type WorkflowType,
  type PipelinePhase,
  type Message,
  type OAuthConfig,
  type SkillCategory,
} from "./schemas";

// ── Errors (tagged, type-safe) ─────────────────────────────
export {
  FileNotFoundError,
  FileWriteError,
  JsonParseError,
  WorkspaceNotInitializedError,
  TaskNotFoundError,
  AgentNotFoundError,
  AgentNoKernelError,
  AgentSpawnError,
  ConvoyNotFoundError,
  ConvoyAlreadyCompletedError,
  GitOperationError,
  InvalidGitHubUrlError,
  PRCreationError,
  ProviderAuthError,
  TokenExpiredError,
  TokenNotFoundError,
  CommandExecutionError,
  PipelineError,
} from "./errors";

// ── Services (Effect Context Tags + Live Layers) ───────────
export {
  WorkspaceRoot,
  WorkspaceRootLive,
  ConfigService,
  ConfigServiceLive,
} from "./services";

export { TaskService, TaskServiceLive } from "./TaskService";
export { ConvoyService, ConvoyServiceLive } from "./ConvoyService";
export {
  RouterService,
  RouterServiceLive,
  analyzeComplexity,
} from "./RouterService";

// ── Composition helper ─────────────────────────────────────
export { AppLayer } from "./layers";
