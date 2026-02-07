/**
 * Effect-based typed error hierarchy for CreateSuite.
 *
 * Every error is a tagged class so it can be discriminated in
 * `Effect.catchTag` and surfaced in the error channel of `Effect<A, E, R>`.
 */
import { Data } from "effect";

// ── File / IO ──────────────────────────────────────────────

export class FileNotFoundError extends Data.TaggedError("FileNotFoundError")<{
  readonly path: string;
  readonly message: string;
}> {}

export class FileWriteError extends Data.TaggedError("FileWriteError")<{
  readonly path: string;
  readonly message: string;
}> {}

export class JsonParseError extends Data.TaggedError("JsonParseError")<{
  readonly path: string;
  readonly message: string;
}> {}

// ── Workspace ──────────────────────────────────────────────

export class WorkspaceNotInitializedError extends Data.TaggedError(
  "WorkspaceNotInitializedError"
)<{
  readonly workspaceRoot: string;
}> {}

// ── Task ───────────────────────────────────────────────────

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
  readonly taskId: string;
}> {}

// ── Agent ──────────────────────────────────────────────────

export class AgentNotFoundError extends Data.TaggedError(
  "AgentNotFoundError"
)<{
  readonly agentId: string;
}> {}

export class AgentNoKernelError extends Data.TaggedError(
  "AgentNoKernelError"
)<{
  readonly agentId: string;
}> {}

export class AgentSpawnError extends Data.TaggedError("AgentSpawnError")<{
  readonly agentId: string;
  readonly message: string;
}> {}

// ── Convoy ─────────────────────────────────────────────────

export class ConvoyNotFoundError extends Data.TaggedError(
  "ConvoyNotFoundError"
)<{
  readonly convoyId: string;
}> {}

export class ConvoyAlreadyCompletedError extends Data.TaggedError(
  "ConvoyAlreadyCompletedError"
)<{
  readonly convoyId: string;
}> {}

// ── Git / PR ───────────────────────────────────────────────

export class GitOperationError extends Data.TaggedError(
  "GitOperationError"
)<{
  readonly operation: string;
  readonly message: string;
}> {}

export class InvalidGitHubUrlError extends Data.TaggedError(
  "InvalidGitHubUrlError"
)<{
  readonly url: string;
}> {}

export class PRCreationError extends Data.TaggedError("PRCreationError")<{
  readonly message: string;
}> {}

// ── Provider / Auth ────────────────────────────────────────

export class ProviderAuthError extends Data.TaggedError(
  "ProviderAuthError"
)<{
  readonly provider: string;
  readonly message: string;
}> {}

export class TokenExpiredError extends Data.TaggedError(
  "TokenExpiredError"
)<{
  readonly provider: string;
}> {}

export class TokenNotFoundError extends Data.TaggedError(
  "TokenNotFoundError"
)<{
  readonly provider: string;
}> {}

// ── Command / Process ──────────────────────────────────────

export class CommandExecutionError extends Data.TaggedError(
  "CommandExecutionError"
)<{
  readonly command: string;
  readonly message: string;
  readonly exitCode?: number;
}> {}

// ── Pipeline ───────────────────────────────────────────────

export class PipelineError extends Data.TaggedError("PipelineError")<{
  readonly phase: string;
  readonly message: string;
}> {}
