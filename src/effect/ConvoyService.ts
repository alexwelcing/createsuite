/**
 * Effect-based Convoy Manager.
 *
 * Manages convoy lifecycle — creation, task assignment, execution tracking.
 * All errors typed in the error channel.
 */
import { Context, Effect, Layer, Option } from "effect";
import type { Convoy, ConvoyStatus } from "./schemas";
import { ConfigService } from "./services";
import { TaskService } from "./TaskService";
import {
  ConvoyNotFoundError,
  ConvoyAlreadyCompletedError,
  TaskNotFoundError,
  FileWriteError,
  JsonParseError,
} from "./errors";

// ── Service interface ──────────────────────────────────────

export class ConvoyService extends Context.Tag("ConvoyService")<
  ConvoyService,
  {
    readonly createConvoy: (
      name: string,
      description: string,
      taskIds: string[]
    ) => Effect.Effect<
      Convoy,
      TaskNotFoundError | FileWriteError | JsonParseError
    >;

    readonly getConvoy: (
      convoyId: string
    ) => Effect.Effect<Option.Option<Convoy>, JsonParseError>;

    readonly addTasks: (
      convoyId: string,
      taskIds: string[]
    ) => Effect.Effect<
      Convoy,
      | ConvoyNotFoundError
      | ConvoyAlreadyCompletedError
      | TaskNotFoundError
      | FileWriteError
      | JsonParseError
    >;

    readonly updateStatus: (
      convoyId: string,
      status: ConvoyStatus
    ) => Effect.Effect<
      Convoy,
      ConvoyNotFoundError | FileWriteError | JsonParseError
    >;

    readonly getProgress: (
      convoyId: string
    ) => Effect.Effect<
      {
        total: number;
        completed: number;
        inProgress: number;
        open: number;
        percentComplete: number;
      },
      ConvoyNotFoundError | JsonParseError
    >;

    readonly listConvoys: () => Effect.Effect<
      ReadonlyArray<Convoy>,
      JsonParseError
    >;
  }
>() {}

// ── Live implementation ────────────────────────────────────

export const ConvoyServiceLive = Layer.effect(
  ConvoyService,
  Effect.all([ConfigService, TaskService]).pipe(
    Effect.map(([config, tasks]) => {
      const generateId = (): string => {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let id = "cv-";
        for (let i = 0; i < 5; i++) {
          id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
      };

      const requireConvoy = (
        convoyId: string
      ): Effect.Effect<Convoy, ConvoyNotFoundError | JsonParseError> =>
        Effect.gen(function* () {
          const opt = yield* config.loadConvoy(convoyId);
          if (Option.isNone(opt)) {
            return yield* Effect.fail(new ConvoyNotFoundError({ convoyId }));
          }
          return opt.value;
        });

      const verifyTasksExist = (
        taskIds: string[]
      ): Effect.Effect<void, TaskNotFoundError | JsonParseError> =>
        Effect.gen(function* () {
          for (const id of taskIds) {
            const opt = yield* tasks.getTask(id);
            if (Option.isNone(opt)) {
              return yield* Effect.fail(new TaskNotFoundError({ taskId: id }));
            }
          }
        });

      return {
        createConvoy: (
          name: string,
          description: string,
          taskIds: string[]
        ): Effect.Effect<Convoy, TaskNotFoundError | FileWriteError | JsonParseError> =>
          Effect.gen(function* () {
            yield* verifyTasksExist(taskIds);
            const convoy: Convoy = {
              id: generateId(),
              name,
              description,
              tasks: taskIds,
              createdAt: new Date(),
              status: "active",
            };
            yield* config.saveConvoy(convoy);
            return convoy;
          }),

        getConvoy: (convoyId: string) => config.loadConvoy(convoyId),

        addTasks: (
          convoyId: string,
          taskIds: string[]
        ): Effect.Effect<
          Convoy,
          ConvoyNotFoundError | ConvoyAlreadyCompletedError | TaskNotFoundError | FileWriteError | JsonParseError
        > =>
          Effect.gen(function* () {
            const convoy = yield* requireConvoy(convoyId);
            if (convoy.status === "completed") {
              return yield* Effect.fail(
                new ConvoyAlreadyCompletedError({ convoyId })
              );
            }
            yield* verifyTasksExist(taskIds);
            const newTasks = taskIds.filter(
              (id) => !convoy.tasks.includes(id)
            );
            const updated: Convoy = {
              ...convoy,
              tasks: [...convoy.tasks, ...newTasks],
            };
            yield* config.saveConvoy(updated);
            return updated;
          }),

        updateStatus: (
          convoyId: string,
          status: ConvoyStatus
        ): Effect.Effect<Convoy, ConvoyNotFoundError | FileWriteError | JsonParseError> =>
          Effect.gen(function* () {
            const convoy = yield* requireConvoy(convoyId);
            const updated: Convoy = { ...convoy, status };
            yield* config.saveConvoy(updated);
            return updated;
          }),

        getProgress: (
          convoyId: string
        ): Effect.Effect<
          { total: number; completed: number; inProgress: number; open: number; percentComplete: number },
          ConvoyNotFoundError | JsonParseError
        > =>
          Effect.gen(function* () {
            const convoy = yield* requireConvoy(convoyId);
            const taskOptions = yield* Effect.all(
              convoy.tasks.map((id) => tasks.getTask(id)),
              { concurrency: "unbounded" }
            );
            const loadedTasks = taskOptions
              .filter(Option.isSome)
              .map((o) => o.value);
            const total = loadedTasks.length;
            const completed = loadedTasks.filter(
              (t) => t.status === "completed"
            ).length;
            const inProgress = loadedTasks.filter(
              (t) => t.status === "in_progress"
            ).length;
            const open = loadedTasks.filter(
              (t) => t.status === "open"
            ).length;

            return {
              total,
              completed,
              inProgress,
              open,
              percentComplete:
                total > 0 ? Math.round((completed / total) * 100) : 0,
            };
          }),

        listConvoys: () => config.listConvoys(),
      };
    })
  )
);
