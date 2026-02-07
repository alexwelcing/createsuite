/**
 * Effect-based Plan Service.
 *
 * Replaces PlanManager — the orchestration brain of CreateSuite.
 *
 * Takes a high-level goal and a target repo, then:
 * 1. Analyzes via RouterService
 * 2. Decomposes into concrete tasks
 * 3. Creates a convoy grouping those tasks
 * 4. Creates agents with matching capabilities
 * 5. Persists plan as markdown
 *
 * Dependencies: ConfigService, TaskService, ConvoyService,
 *               RouterService, AgentService
 */
import { Context, Effect, Layer } from "effect";
import * as fsp from "fs/promises";
import * as path from "path";
import type {
  RepoConfig,
  Task,
  Convoy,
  Agent,
  AgentRuntime,
  TaskPriority,
} from "./schemas";
import { WorkspaceRoot } from "./services";
import { TaskService } from "./TaskService";
import { ConvoyService } from "./ConvoyService";
import { RouterService } from "./RouterService";
import { AgentService } from "./AgentService";
import {
  FileWriteError,
  JsonParseError,
  TaskNotFoundError,
  ConvoyNotFoundError,
  AgentNotFoundError,
  AgentSpawnError,
} from "./errors";

// ── Plan type (local, not persisted via Schema) ────────────

export interface Plan {
  name: string;
  path: string;
  content: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    completed: boolean;
    lineNumber: number;
  }>;
  createdAt: Date;
  modifiedAt: Date;
}

// ── Service interface ──────────────────────────────────────

export class PlanService extends Context.Tag("PlanService")<
  PlanService,
  {
    /** Create a plan from a high-level goal. */
    readonly createPlan: (
      goal: string,
      repoConfig: RepoConfig,
      options?: {
        maxAgents?: number;
        runtime?: AgentRuntime;
        provider?: string;
      }
    ) => Effect.Effect<
      { plan: Plan; convoy: Convoy; tasks: ReadonlyArray<Task> },
      | FileWriteError
      | JsonParseError
      | TaskNotFoundError
      | ConvoyNotFoundError
    >;

    /** Execute a plan — assign tasks to agents. */
    readonly executePlan: (
      convoy: Convoy,
      repoConfig: RepoConfig,
      workspaceRoot: string,
      options?: {
        provider?: string;
        model?: string;
        githubToken?: string;
      }
    ) => Effect.Effect<
      void,
      | JsonParseError
      | FileWriteError
      | AgentNotFoundError
      | AgentSpawnError
      | TaskNotFoundError
      | ConvoyNotFoundError
    >;

    /** List all saved plans. */
    readonly listPlans: () => Effect.Effect<ReadonlyArray<string>>;

    /** Load a plan by filename. */
    readonly loadPlan: (
      filename: string
    ) => Effect.Effect<string, FileWriteError>;
  }
>() {}

// ── Goal decomposition (pure function) ─────────────────────

interface SubTask {
  title: string;
  description: string;
  priority: TaskPriority;
  tags: string[];
}

const decomposeGoal = (
  goal: string,
  _suggestedSkills: string[],
  repoConfig: RepoConfig
): SubTask[] => {
  const lower = goal.toLowerCase();
  const subtasks: SubTask[] = [];

  if (/test|coverage|spec/i.test(lower)) {
    subtasks.push({
      title: `Add unit tests for ${repoConfig.name}`,
      description: `Analyze ${repoConfig.name} source code and add comprehensive unit tests. Goal: ${goal}`,
      priority: "high",
      tags: ["testing", "automated"],
    });
    if (/integration|e2e|end.to.end/i.test(lower)) {
      subtasks.push({
        title: `Add integration tests for ${repoConfig.name}`,
        description: `Add integration/E2E tests covering the main user workflows. Goal: ${goal}`,
        priority: "medium",
        tags: ["testing", "integration", "automated"],
      });
    }
  }

  if (/refactor|restructure|clean|organiz|simplif/i.test(lower)) {
    subtasks.push({
      title: `Refactor ${repoConfig.name} codebase`,
      description: `Review and refactor code for clarity, maintainability, and best practices. Goal: ${goal}`,
      priority: "medium",
      tags: ["refactor", "automated"],
    });
  }

  if (/fix|bug|issue|error|broken/i.test(lower)) {
    subtasks.push({
      title: `Fix issues in ${repoConfig.name}`,
      description: `Identify and fix bugs, lint errors, and broken functionality. Goal: ${goal}`,
      priority: "high",
      tags: ["bugfix", "automated"],
    });
  }

  if (/document|readme|doc|guide|comment/i.test(lower)) {
    subtasks.push({
      title: `Improve documentation for ${repoConfig.name}`,
      description: `Add or improve documentation, README, code comments, and guides. Goal: ${goal}`,
      priority: "medium",
      tags: ["documentation", "automated"],
    });
  }

  if (/add|implement|build|create|feature|new/i.test(lower)) {
    subtasks.push({
      title: `Implement: ${goal.slice(0, 80)}`,
      description: `Implement the following in ${repoConfig.name}: ${goal}`,
      priority: "high",
      tags: ["feature", "automated"],
    });
  }

  if (/performance|optimiz|speed|fast|slow/i.test(lower)) {
    subtasks.push({
      title: `Optimize performance in ${repoConfig.name}`,
      description: `Profile and optimize performance bottlenecks. Goal: ${goal}`,
      priority: "medium",
      tags: ["performance", "automated"],
    });
  }

  if (/security|vulnerab|auth|permission|xss|injection/i.test(lower)) {
    subtasks.push({
      title: `Security review for ${repoConfig.name}`,
      description: `Audit code for security vulnerabilities and apply fixes. Goal: ${goal}`,
      priority: "critical",
      tags: ["security", "automated"],
    });
  }

  if (subtasks.length === 0) {
    subtasks.push({
      title: goal.slice(0, 100),
      description: `Complete the following work on ${repoConfig.name}: ${goal}`,
      priority: "medium",
      tags: ["general", "automated"],
    });
  }

  return subtasks;
};

// ── Live implementation ────────────────────────────────────

export const PlanServiceLive = Layer.effect(
  PlanService,
  Effect.gen(function* () {
    const ws = yield* WorkspaceRoot;
    const taskService = yield* TaskService;
    const convoyService = yield* ConvoyService;
    const routerService = yield* RouterService;
    const agentService = yield* AgentService;

    const plansDir = path.join(ws.path, ".createsuite", "plans");

    return {
      createPlan: (
        goal: string,
        repoConfig: RepoConfig,
        options: {
          maxAgents?: number;
          runtime?: AgentRuntime;
          provider?: string;
        } = {}
      ) =>
        Effect.gen(function* () {
          const maxAgents = options.maxAgents || 3;
          const runtime: AgentRuntime = options.runtime || "local";

          // 1. Analyze the goal
          const routerResult = routerService.route(goal);
          const suggestedSkills = [...routerResult.suggestedSkills];

          // 2. Decompose goal into subtasks
          const subtasks = decomposeGoal(
            goal,
            suggestedSkills,
            repoConfig
          );

          // 3. Create tasks
          const createdTasks: Task[] = [];
          for (const sub of subtasks) {
            const task = yield* taskService.createTask(
              sub.title,
              sub.description,
              sub.priority,
              sub.tags
            );
            createdTasks.push(task);
          }

          // 4. Create convoy
          const convoy = yield* convoyService.createConvoy(
            `Plan: ${goal.slice(0, 50)}`,
            `Auto-generated plan for: ${goal}\nRepo: ${repoConfig.url}`,
            createdTasks.map((t) => t.id)
          );

          // 5. Create agents
          const agentCount = Math.min(createdTasks.length, maxAgents);
          const agents: Array<{
            agent: Agent;
            task: Task;
            agentType: string;
          }> = [];
          for (let i = 0; i < agentCount; i++) {
            const task = createdTasks[i];
            const agentType = routerService.suggestAgentType(
              task.description
            );
            const agent = yield* agentService.createAgent(
              `${agentType}-${task.id}`,
              suggestedSkills,
              { runtime }
            );
            agents.push({ agent, task, agentType });
          }

          // 6. Save plan as markdown
          yield* Effect.tryPromise({
            try: () => fsp.mkdir(plansDir, { recursive: true }),
            catch: () =>
              new FileWriteError({
                path: plansDir,
                message: `Failed to create plans directory`,
              }),
          });

          const planId = `plan-${Date.now()}`;
          const planPath = path.join(plansDir, `${planId}.md`);

          const lines = [
            `# Plan: ${goal}`,
            "",
            `**Repository:** ${repoConfig.url}`,
            `**Convoy:** ${convoy.id}`,
            `**Created:** ${new Date().toISOString()}`,
            "",
            "## Tasks",
            "",
          ];

          for (const task of createdTasks) {
            const agent = agents.find((a) => a.task.id === task.id);
            lines.push(`- [ ] **${task.id}** — ${task.title}`);
            if (agent) {
              lines.push(
                `  - Agent: ${agent.agent.name} (${agent.agentType})`
              );
            }
            lines.push(`  - Priority: ${task.priority}`);
            lines.push(`  - Tags: ${task.tags.join(", ")}`);
            lines.push("");
          }

          const content = lines.join("\n");

          yield* Effect.tryPromise({
            try: () => fsp.writeFile(planPath, content),
            catch: () =>
              new FileWriteError({
                path: planPath,
                message: `Failed to write plan`,
              }),
          });

          const plan: Plan = {
            name: goal,
            path: planPath,
            content,
            tasks: createdTasks.map((t, i) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              completed: false,
              lineNumber: 10 + i * 4,
            })),
            createdAt: new Date(),
            modifiedAt: new Date(),
          };

          return { plan, convoy, tasks: createdTasks };
        }),

      executePlan: (
        convoy: Convoy,
        _repoConfig: RepoConfig,
        workspaceRoot: string,
        _options: {
          provider?: string;
          model?: string;
          githubToken?: string;
        } = {}
      ) =>
        Effect.gen(function* () {
          // Load all tasks in the convoy
          const taskResults = yield* Effect.all(
            convoy.tasks.map((id) => taskService.getTask(id)),
            { concurrency: "unbounded" }
          );
          const validTasks = taskResults
            .filter((opt) => opt._tag === "Some")
            .map((opt) => (opt as { _tag: "Some"; value: Task }).value);

          const agents = yield* agentService.listAgents();
          const mutableAgents = [...agents];

          for (const task of validTasks) {
            const idleIdx = mutableAgents.findIndex(
              (a) => a.status === "idle" && a.currentTask === undefined
            );

            if (idleIdx >= 0) {
              const idleAgent = mutableAgents[idleIdx];
              yield* agentService.assignTaskToAgent(
                idleAgent.id,
                task.id,
                workspaceRoot
              );
              yield* taskService.assignTask(task.id, idleAgent.id);
              // Mark as used locally
              mutableAgents[idleIdx] = {
                ...idleAgent,
                status: "working",
                currentTask: task.id,
              } as Agent;
            }
          }

          yield* convoyService.updateStatus(convoy.id, "active");
        }),

      listPlans: () =>
        Effect.tryPromise({
          try: async () => {
            const files = await fsp.readdir(plansDir);
            return files.filter((f) => f.endsWith(".md"));
          },
          catch: () => [] as string[],
        }).pipe(
          Effect.catchAll(() => Effect.succeed([] as readonly string[]))
        ),

      loadPlan: (filename: string) =>
        Effect.tryPromise({
          try: () => fsp.readFile(path.join(plansDir, filename), "utf-8"),
          catch: () =>
            new FileWriteError({
              path: path.join(plansDir, filename),
              message: `Failed to read plan ${filename}`,
            }),
        }),
    };
  })
);
