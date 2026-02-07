/**
 * Effect-based Task Manager.
 *
 * Replaces the class-based TaskManager with pure Effect functions
 * that depend on ConfigService via the Effect context.
 *
 * All errors are typed in the error channel — no `throw`.
 */
import { Context, Effect, Layer, Option } from "effect";
import type { Task, TaskStatus, TaskPriority } from "./schemas";
import { ConfigService } from "./services";
import { TaskNotFoundError, FileWriteError, JsonParseError } from "./errors";

// ── Service interface ──────────────────────────────────────

export class TaskService extends Context.Tag("TaskService")<
  TaskService,
  {
    readonly createTask: (
      title: string,
      description: string,
      priority?: TaskPriority,
      tags?: string[]
    ) => Effect.Effect<Task, FileWriteError>;

    readonly getTask: (
      taskId: string
    ) => Effect.Effect<Option.Option<Task>, JsonParseError>;

    readonly updateTask: (
      taskId: string,
      updates: Partial<Task>
    ) => Effect.Effect<Task, TaskNotFoundError | FileWriteError | JsonParseError>;

    readonly assignTask: (
      taskId: string,
      agentId: string
    ) => Effect.Effect<Task, TaskNotFoundError | FileWriteError | JsonParseError>;

    readonly completeTask: (
      taskId: string
    ) => Effect.Effect<Task, TaskNotFoundError | FileWriteError | JsonParseError>;

    readonly listTasks: (filters?: {
      status?: TaskStatus;
      assignedAgent?: string;
      priority?: TaskPriority;
    }) => Effect.Effect<ReadonlyArray<Task>, JsonParseError>;

    readonly getOpenTasks: () => Effect.Effect<
      ReadonlyArray<Task>,
      JsonParseError
    >;

    readonly getAgentTasks: (
      agentId: string
    ) => Effect.Effect<ReadonlyArray<Task>, JsonParseError>;
  }
>() {}

// ── Helpers ────────────────────────────────────────────────

const generateTaskId = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "cs-";
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

// ── Live implementation ────────────────────────────────────

export const TaskServiceLive = Layer.effect(
  TaskService,
  Effect.map(ConfigService, (config) => {

    const requireTask = (
      taskId: string
    ): Effect.Effect<Task, TaskNotFoundError | JsonParseError> =>
      Effect.gen(function* () {
        const opt = yield* config.loadTask(taskId);
        if (Option.isNone(opt)) {
          return yield* Effect.fail(new TaskNotFoundError({ taskId }));
        }
        return opt.value;
      });

    return {
      createTask: (
        title: string,
        description: string,
        priority: TaskPriority = "medium",
        tags: string[] = []
      ): Effect.Effect<Task, FileWriteError> => {
        const now = new Date();
        const task: Task = {
          id: generateTaskId(),
          title,
          description,
          status: "open",
          createdAt: now,
          updatedAt: now,
          priority,
          tags,
        };
        return Effect.gen(function* () {
          yield* config.saveTask(task);
          return task;
        });
      },

      getTask: (taskId: string) => config.loadTask(taskId),

      updateTask: (
        taskId: string,
        updates: Partial<Task>
      ): Effect.Effect<Task, TaskNotFoundError | FileWriteError | JsonParseError> =>
        Effect.gen(function* () {
          const task = yield* requireTask(taskId);
          const updatedTask: Task = {
            ...task,
            ...updates,
            updatedAt: new Date(),
          } as Task;
          yield* config.saveTask(updatedTask);
          return updatedTask;
        }),

      assignTask: (
        taskId: string,
        agentId: string
      ): Effect.Effect<Task, TaskNotFoundError | FileWriteError | JsonParseError> =>
        Effect.gen(function* () {
          const task = yield* requireTask(taskId);
          const updatedTask: Task = {
            ...task,
            assignedAgent: agentId,
            status: "in_progress" as const,
            updatedAt: new Date(),
          };
          yield* config.saveTask(updatedTask);
          return updatedTask;
        }),

      completeTask: (
        taskId: string
      ): Effect.Effect<Task, TaskNotFoundError | FileWriteError | JsonParseError> =>
        Effect.gen(function* () {
          const task = yield* requireTask(taskId);
          const updatedTask: Task = {
            ...task,
            status: "completed" as const,
            updatedAt: new Date(),
          };
          yield* config.saveTask(updatedTask);
          return updatedTask;
        }),

      listTasks: (filters?) =>
        Effect.gen(function* () {
          const all = yield* config.listTasks();
          let result = [...all];
          if (filters?.status) {
            result = result.filter((t) => t.status === filters.status);
          }
          if (filters?.assignedAgent) {
            result = result.filter(
              (t) => t.assignedAgent === filters.assignedAgent
            );
          }
          if (filters?.priority) {
            result = result.filter((t) => t.priority === filters.priority);
          }
          return result;
        }),

      getOpenTasks: () =>
        Effect.gen(function* () {
          const all = yield* config.listTasks();
          return all.filter((t) => t.status === "open");
        }),

      getAgentTasks: (agentId: string) =>
        Effect.gen(function* () {
          const all = yield* config.listTasks();
          return all.filter((t) => t.assignedAgent === agentId);
        }),
    };
  })
);
