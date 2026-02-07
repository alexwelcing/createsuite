/**
 * Effect-based Pipeline Service.
 *
 * Replaces Entrypoint — the top-level orchestrator for a full
 * CreateSuite run: clone → plan → execute → commit → PR.
 *
 * Depends on: GitService, PlanService, PRService, ConvoyService,
 *             TaskService, AgentService
 *
 * Two modes:
 *   1. Remote (API) — delegates to server's PipelineRunner
 *   2. Local (CLI)  — runs the full pipeline in-process
 */
import { Context, Effect, Layer } from "effect";
import * as fsp from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  PipelineConfig,
  PipelineStatus,
  PipelinePhase,
  Task,
} from "./schemas";
import { WorkspaceRoot } from "./services";
import { TaskService } from "./TaskService";
import { ConvoyService } from "./ConvoyService";
import { AgentService } from "./AgentService";
import { GitService } from "./GitService";
import { PRService } from "./PRService";
import { PlanService } from "./PlanService";
import {
  PipelineError,
  FileWriteError,
  GitOperationError,
  InvalidGitHubUrlError,
  PRCreationError,
  CommandExecutionError,
  JsonParseError,
  TaskNotFoundError,
  ConvoyNotFoundError,
  AgentNotFoundError,
  AgentSpawnError,
} from "./errors";

// ── Service interface ──────────────────────────────────────

type PipelineErrors =
  | PipelineError
  | FileWriteError
  | GitOperationError
  | InvalidGitHubUrlError
  | PRCreationError
  | CommandExecutionError
  | JsonParseError
  | TaskNotFoundError
  | ConvoyNotFoundError
  | AgentNotFoundError
  | AgentSpawnError;

export class PipelineService extends Context.Tag("PipelineService")<
  PipelineService,
  {
    /** Run the full pipeline locally (CLI mode). */
    readonly start: (
      config: PipelineConfig
    ) => Effect.Effect<PipelineStatus, PipelineErrors>;

    /** Trigger the pipeline via the server API. */
    readonly triggerRemote: (
      config: PipelineConfig,
      serverUrl?: string
    ) => Effect.Effect<{ pipelineId: string }, PipelineError>;

    /** Get the current pipeline status. */
    readonly getStatus: () => Effect.Effect<PipelineStatus | null>;
  }
>() {}

// ── Live implementation ────────────────────────────────────

export const PipelineServiceLive = Layer.effect(
  PipelineService,
  Effect.gen(function* () {
    const ws = yield* WorkspaceRoot;
    const taskService = yield* TaskService;
    const convoyService = yield* ConvoyService;
    const agentService = yield* AgentService;
    const gitService = yield* GitService;
    const prService = yield* PRService;
    const planService = yield* PlanService;

    const statusPath = path.join(
      ws.path,
      ".createsuite",
      "pipeline-status.json"
    );

    const saveStatus = (
      status: PipelineStatus
    ): Effect.Effect<void, FileWriteError> =>
      Effect.tryPromise({
        try: async () => {
          const dir = path.dirname(statusPath);
          await fsp.mkdir(dir, { recursive: true });
          await fsp.writeFile(statusPath, JSON.stringify(status, null, 2));
        },
        catch: () =>
          new FileWriteError({
            path: statusPath,
            message: "Failed to write pipeline status",
          }),
      });

    const formatDuration = (start: Date, end: Date): string => {
      const ms = end.getTime() - start.getTime();
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
    };

    const waitForAgentCompletion = (
      convoyId: string,
      _taskCount: number
    ): Effect.Effect<void, JsonParseError | ConvoyNotFoundError> =>
      Effect.gen(function* () {
        const maxWait = 15 * 60 * 1000;
        const checkInterval = 3000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
          const progress = yield* convoyService.getProgress(convoyId);

          if (progress.completed >= progress.total && progress.total > 0) {
            return;
          }

          const agents = yield* agentService.listAgents();
          const workingAgents = agents.filter(
            (a) => a.status === "working"
          );
          if (
            workingAgents.length === 0 &&
            progress.inProgress === 0 &&
            progress.open === 0
          ) {
            return;
          }

          yield* Effect.promise(
            () => new Promise<void>((r) => setTimeout(r, checkInterval))
          );
        }
      });

    return {
      start: (config: PipelineConfig) =>
        Effect.gen(function* () {
          const pipelineId = uuidv4().slice(0, 12);
          const status: PipelineStatus = {
            id: pipelineId,
            repoUrl: config.repoUrl,
            goal: config.goal,
            phase: "cloning" as PipelinePhase,
            startedAt: new Date(),
          };

          yield* saveStatus(status);

          // ── Phase 1: Clone ──
          const mutableStatus = { ...status };
          mutableStatus.phase = "cloning";
          yield* saveStatus(mutableStatus);

          const repoConfig = yield* gitService.cloneRepo(config.repoUrl, {
            githubToken: config.githubToken,
          });

          if (config.dryRun) {
            mutableStatus.phase = "completed";
            mutableStatus.completedAt = new Date();
            yield* saveStatus(mutableStatus);
            return mutableStatus;
          }

          // ── Phase 2: Plan ──
          mutableStatus.phase = "planning";
          yield* saveStatus(mutableStatus);

          const runtime = process.env.FLY_API_TOKEN
            ? ("fly" as const)
            : ("local" as const);
          const { convoy, tasks } = yield* planService.createPlan(
            config.goal,
            repoConfig,
            {
              maxAgents: config.maxAgents || 3,
              runtime,
              provider: config.provider,
            }
          );
          mutableStatus.convoyId = convoy.id;
          yield* saveStatus(mutableStatus);

          // ── Phase 3: Execute ──
          mutableStatus.phase = "executing";
          yield* saveStatus(mutableStatus);

          // Try remote first for Fly runtime
          if (runtime === "fly") {
            const remoteResult = yield* Effect.tryPromise({
              try: async () => {
                const url =
                  process.env.CREATESUITE_SERVER_URL ||
                  "http://localhost:3001";
                const resp = await fetch(`${url}/api/pipeline/start`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    repoUrl: config.repoUrl,
                    goal: config.goal,
                    provider: config.provider,
                    model: config.model,
                    githubToken: config.githubToken,
                    maxAgents: config.maxAgents,
                  }),
                });
                if (!resp.ok) return null;
                const result = (await resp.json()) as {
                  data: { pipelineId: string };
                };
                return result.data.pipelineId;
              },
              catch: () => null as string | null,
            }).pipe(Effect.catchAll(() => Effect.succeed(null)));

            if (remoteResult) {
              return mutableStatus;
            }
          }

          // Local execution
          yield* planService.executePlan(convoy, repoConfig, ws.path, {
            provider: config.provider,
            model: config.model,
            githubToken: config.githubToken,
          });

          yield* waitForAgentCompletion(convoy.id, tasks.length);

          // ── Phase 4: Commit ──
          mutableStatus.phase = "committing";
          yield* saveStatus(mutableStatus);

          const branchName = `createsuite/${convoy.id}`;
          yield* gitService.createWorkBranch(
            repoConfig,
            "consolidated",
            convoy.id
          );

          const commitResult = yield* gitService.commitAndPush(
            repoConfig,
            branchName,
            `feat: ${config.goal}\n\nAutomated by CreateSuite\nConvoy: ${convoy.id}\nTasks: ${tasks.map((t) => t.id).join(", ")}`
          );

          if (!commitResult.pushed) {
            mutableStatus.phase = "completed";
            mutableStatus.completedAt = new Date();
            yield* saveStatus(mutableStatus);
            return mutableStatus;
          }

          // ── Phase 5: Create PR ──
          mutableStatus.phase = "pr_creating";
          yield* saveStatus(mutableStatus);

          const prBody = prService.buildPRBody({
            goal: config.goal,
            taskId: tasks.map((t) => t.id).join(", "),
            agentName: `CreateSuite (${tasks.length} agent${tasks.length > 1 ? "s" : ""})`,
            convoyId: convoy.id,
            changes: tasks.map((t) => t.title),
          });

          const prResult = yield* prService
            .createPR({
              repoConfig,
              branch: branchName,
              title: `[CreateSuite] ${config.goal}`,
              body: prBody,
            })
            .pipe(
              Effect.map((pr) => pr.url),
              Effect.catchAll(() => Effect.succeed(null as string | null))
            );

          if (prResult) {
            mutableStatus.prUrl = prResult;
          }

          // ── Done ──
          mutableStatus.phase = "completed";
          mutableStatus.completedAt = new Date();
          yield* saveStatus(mutableStatus);

          return mutableStatus;
        }),

      triggerRemote: (config: PipelineConfig, serverUrl?: string) =>
        Effect.tryPromise({
          try: async () => {
            const url =
              serverUrl ||
              process.env.CREATESUITE_SERVER_URL ||
              "http://localhost:3001";
            const resp = await fetch(`${url}/api/pipeline/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                repoUrl: config.repoUrl,
                goal: config.goal,
                provider: config.provider,
                model: config.model,
                githubToken: config.githubToken,
                maxAgents: config.maxAgents,
              }),
            });
            if (!resp.ok) {
              const body = await resp.text();
              throw new Error(`Pipeline API error: ${resp.status} — ${body}`);
            }
            const result = (await resp.json()) as {
              data: { pipelineId: string };
            };
            return result.data;
          },
          catch: (err) =>
            new PipelineError({
              phase: "trigger",
              message: err instanceof Error ? err.message : String(err),
            }),
        }),

      getStatus: () =>
        Effect.tryPromise({
          try: async () => {
            const data = await fsp.readFile(statusPath, "utf-8");
            const status = JSON.parse(data) as PipelineStatus;
            return {
              ...status,
              startedAt: new Date(status.startedAt),
              ...(status.completedAt && {
                completedAt: new Date(status.completedAt),
              }),
            };
          },
          catch: () => null as PipelineStatus | null,
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed(null as PipelineStatus | null)
          )
        ),
    };
  })
);
