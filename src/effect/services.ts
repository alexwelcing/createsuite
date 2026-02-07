/**
 * Effect service definitions for CreateSuite.
 *
 * Each service is defined as a Context.Tag with its interface,
 * plus a "Live" Layer that provides the concrete implementation.
 * Consumers depend on the Tag, never on the concrete class.
 */
import { Context, Effect, Layer, Option, pipe } from "effect";
import { Schema } from "effect";
import * as fsp from "fs/promises";
import * as fs from "fs";
import * as path from "path";
import {
  TaskSchema,
  AgentSchema,
  ConvoySchema,
  WorkspaceConfigSchema,
  type Task,
  type Agent,
  type Convoy,
  type WorkspaceConfig,
} from "./schemas";
import {
  FileNotFoundError,
  FileWriteError,
  JsonParseError,
  WorkspaceNotInitializedError,
} from "./errors";

// ── WorkspaceRoot ──────────────────────────────────────────

/**
 * A simple service that provides the workspace root path.
 * This replaces the `workspaceRoot: string` constructor param
 * threaded through every class.
 */
export class WorkspaceRoot extends Context.Tag("WorkspaceRoot")<
  WorkspaceRoot,
  { readonly path: string }
>() {}

export const WorkspaceRootLive = (rootPath: string) =>
  Layer.succeed(WorkspaceRoot, { path: rootPath });

// ── ConfigService ──────────────────────────────────────────

/**
 * Manages workspace configuration and entity persistence.
 *
 * Replaces the old `ConfigManager` class with typed errors
 * and Schema-validated reads.
 */
export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  {
    readonly initialize: (
      name: string,
      repository?: string
    ) => Effect.Effect<void, FileWriteError>;

    readonly loadConfig: () => Effect.Effect<
      WorkspaceConfig,
      WorkspaceNotInitializedError | JsonParseError
    >;

    readonly saveConfig: (
      config: WorkspaceConfig
    ) => Effect.Effect<void, FileWriteError>;

    readonly saveTask: (task: Task) => Effect.Effect<void, FileWriteError>;
    readonly loadTask: (
      taskId: string
    ) => Effect.Effect<Option.Option<Task>, JsonParseError>;
    readonly listTasks: () => Effect.Effect<
      ReadonlyArray<Task>,
      JsonParseError
    >;

    readonly saveAgent: (agent: Agent) => Effect.Effect<void, FileWriteError>;
    readonly loadAgent: (
      agentId: string
    ) => Effect.Effect<Option.Option<Agent>, JsonParseError>;
    readonly listAgents: () => Effect.Effect<
      ReadonlyArray<Agent>,
      JsonParseError
    >;

    readonly saveConvoy: (
      convoy: Convoy
    ) => Effect.Effect<void, FileWriteError>;
    readonly loadConvoy: (
      convoyId: string
    ) => Effect.Effect<Option.Option<Convoy>, JsonParseError>;
    readonly listConvoys: () => Effect.Effect<
      ReadonlyArray<Convoy>,
      JsonParseError
    >;
  }
>() {}

// ── Helper: decode JSON file through a Schema ──────────────

const readJsonFile = <A, I>(
  filePath: string,
  schema: Schema.Schema<A, I>
): Effect.Effect<A, FileNotFoundError | JsonParseError> =>
  pipe(
    Effect.tryPromise({
      try: () => fsp.readFile(filePath, "utf-8"),
      catch: () =>
        new FileNotFoundError({
          path: filePath,
          message: `File not found: ${filePath}`,
        }),
    }),
    Effect.flatMap((raw) =>
      pipe(
        Effect.try({
          try: () => JSON.parse(raw),
          catch: () =>
            new JsonParseError({
              path: filePath,
              message: `Invalid JSON in ${filePath}`,
            }),
        }),
        Effect.flatMap((json) =>
          pipe(
            Schema.decodeUnknown(schema)(json),
            Effect.mapError(
              () =>
                new JsonParseError({
                  path: filePath,
                  message: `Schema validation failed for ${filePath}`,
                })
            )
          )
        )
      )
    )
  );

const writeJsonFile = (
  filePath: string,
  data: unknown
): Effect.Effect<void, FileWriteError> =>
  Effect.tryPromise({
    try: async () => {
      const dir = path.dirname(filePath);
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
    },
    catch: () =>
      new FileWriteError({
        path: filePath,
        message: `Failed to write ${filePath}`,
      }),
  });

const ensureDir = (dirPath: string): Effect.Effect<void, FileWriteError> =>
  Effect.tryPromise({
    try: () => fsp.mkdir(dirPath, { recursive: true }),
    catch: () =>
      new FileWriteError({
        path: dirPath,
        message: `Failed to create directory ${dirPath}`,
      }),
  }).pipe(Effect.asVoid);

// ── ConfigService Live implementation ──────────────────────

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.map(WorkspaceRoot, (ws) => {
    const configPath = path.join(ws.path, ".createsuite", "config.json");
    const tasksDir = path.join(ws.path, ".createsuite", "tasks");
    const agentsDir = path.join(ws.path, ".createsuite", "agents");
    const convoysDir = path.join(ws.path, ".createsuite", "convoys");

    const listEntities = <A, I>(
      dir: string,
      schema: Schema.Schema<A, I>
    ): Effect.Effect<ReadonlyArray<A>, JsonParseError> =>
      pipe(
        Effect.tryPromise({
          try: () => fsp.readdir(dir),
          catch: () => [] as string[],
        }),
        Effect.catchAll(() => Effect.succeed([] as string[])),
        Effect.flatMap((files) => {
          const jsonFiles = (files as string[]).filter((f) =>
            f.endsWith(".json")
          );
          return Effect.all(
            jsonFiles.map((f) => {
              const filePath = path.join(dir, f);
              return readJsonFile(filePath, schema).pipe(
                Effect.map(Option.some),
                Effect.catchTag("FileNotFoundError", () =>
                  Effect.succeed(Option.none<A>())
                )
              );
            }),
            { concurrency: "unbounded" }
          );
        }),
        Effect.map((options) =>
          options.filter(Option.isSome).map((o) => o.value)
        )
      );

    return {
      initialize: (name: string, repository?: string) =>
        pipe(
          Effect.all([
            ensureDir(tasksDir),
            ensureDir(agentsDir),
            ensureDir(convoysDir),
            ensureDir(path.join(ws.path, ".createsuite", "hooks")),
          ]),
          Effect.flatMap(() => {
            const config: WorkspaceConfig = {
              name,
              path: ws.path,
              repository,
              agents: [],
              oauthConfig: { scopes: ["repo", "workflow"] },
            };
            return writeJsonFile(configPath, config);
          })
        ),

      loadConfig: () =>
        readJsonFile(configPath, WorkspaceConfigSchema).pipe(
          Effect.catchTag("FileNotFoundError", () =>
            Effect.fail(
              new WorkspaceNotInitializedError({
                workspaceRoot: ws.path,
              })
            )
          )
        ),

      saveConfig: (config: WorkspaceConfig) =>
        writeJsonFile(configPath, config),

      saveTask: (task: Task) =>
        writeJsonFile(path.join(tasksDir, `${task.id}.json`), task),

      loadTask: (taskId: string) =>
        readJsonFile(
          path.join(tasksDir, `${taskId}.json`),
          TaskSchema
        ).pipe(
          Effect.map(Option.some),
          Effect.catchTag("FileNotFoundError", () =>
            Effect.succeed(Option.none<Task>())
          )
        ),

      listTasks: () => listEntities(tasksDir, TaskSchema),

      saveAgent: (agent: Agent) =>
        writeJsonFile(path.join(agentsDir, `${agent.id}.json`), agent),

      loadAgent: (agentId: string) =>
        readJsonFile(
          path.join(agentsDir, `${agentId}.json`),
          AgentSchema
        ).pipe(
          Effect.map(Option.some),
          Effect.catchTag("FileNotFoundError", () =>
            Effect.succeed(Option.none<Agent>())
          )
        ),

      listAgents: () => listEntities(agentsDir, AgentSchema),

      saveConvoy: (convoy: Convoy) =>
        writeJsonFile(path.join(convoysDir, `${convoy.id}.json`), convoy),

      loadConvoy: (convoyId: string) =>
        readJsonFile(
          path.join(convoysDir, `${convoyId}.json`),
          ConvoySchema
        ).pipe(
          Effect.map(Option.some),
          Effect.catchTag("FileNotFoundError", () =>
            Effect.succeed(Option.none<Convoy>())
          )
        ),

      listConvoys: () => listEntities(convoysDir, ConvoySchema),
    };
  })
);
