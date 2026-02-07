/**
 * Effect-based Git Service.
 *
 * Consolidates RepoManager + GitIntegration into a unified service
 * that handles all git operations: clone, branch, commit, push,
 * and workspace git tracking.
 *
 * Uses simple-git under the hood, wrapping every call in Effect
 * with typed errors (GitOperationError, InvalidGitHubUrlError).
 */
import { Context, Effect, Layer, Option } from "effect";
import { Schema } from "effect";
import simpleGit, { SimpleGit } from "simple-git";
import * as path from "path";
import * as fs from "fs";
import * as fsp from "fs/promises";
import type { RepoConfig } from "./schemas";
import { RepoConfigSchema } from "./schemas";
import { WorkspaceRoot } from "./services";
import {
  GitOperationError,
  InvalidGitHubUrlError,
  FileWriteError,
  FileNotFoundError,
  JsonParseError,
} from "./errors";

// ── Helpers ────────────────────────────────────────────────

/** Parse GitHub HTTPS or SSH URLs into owner + name. */
export const parseGitHubUrl = (
  url: string
): Effect.Effect<{ owner: string; name: string }, InvalidGitHubUrlError> => {
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return Effect.succeed({ owner: httpsMatch[1], name: httpsMatch[2] });
  }
  const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    return Effect.succeed({ owner: sshMatch[1], name: sshMatch[2] });
  }
  return Effect.fail(new InvalidGitHubUrlError({ url }));
};

// ── Service interface ──────────────────────────────────────

export class GitService extends Context.Tag("GitService")<
  GitService,
  {
    /** Parse a GitHub URL into owner/name. */
    readonly parseUrl: (
      url: string
    ) => Effect.Effect<{ owner: string; name: string }, InvalidGitHubUrlError>;

    /** Clone a GitHub repository. Returns its RepoConfig. */
    readonly cloneRepo: (
      repoUrl: string,
      options?: {
        depth?: number;
        branch?: string;
        githubToken?: string;
      }
    ) => Effect.Effect<
      RepoConfig,
      InvalidGitHubUrlError | GitOperationError | FileWriteError
    >;

    /** Create a working branch for an agent's task. */
    readonly createWorkBranch: (
      repoConfig: RepoConfig,
      agentId: string,
      taskId: string
    ) => Effect.Effect<string, GitOperationError>;

    /** Commit all changes and push the branch. */
    readonly commitAndPush: (
      repoConfig: RepoConfig,
      branch: string,
      message: string
    ) => Effect.Effect<
      { pushed: boolean; commitHash?: string },
      GitOperationError
    >;

    /** List all cloned repos. */
    readonly listRepos: () => Effect.Effect<
      ReadonlyArray<RepoConfig>,
      JsonParseError
    >;

    /** Get a specific repo by owner/name. */
    readonly getRepo: (
      owner: string,
      name: string
    ) => Effect.Effect<Option.Option<RepoConfig>, JsonParseError>;

    /** Remove a cloned repo. */
    readonly removeRepo: (
      owner: string,
      name: string
    ) => Effect.Effect<void, GitOperationError | FileWriteError>;

    // ── Workspace git helpers (from GitIntegration) ──────

    /** Initialize the workspace git repo if needed. */
    readonly initWorkspaceGit: () => Effect.Effect<void, GitOperationError>;

    /** Commit changes in .createsuite/ directory. */
    readonly commitTaskChanges: (
      message: string
    ) => Effect.Effect<void, GitOperationError>;

    /** Get current branch name. */
    readonly getCurrentBranch: () => Effect.Effect<string, GitOperationError>;

    /** Switch to main/master branch. */
    readonly switchToMain: () => Effect.Effect<void, GitOperationError>;

    /** Check if working directory is clean. */
    readonly isClean: () => Effect.Effect<boolean, GitOperationError>;

    /** Stage all changes and commit. Returns commit hash or null. */
    readonly commitAll: (
      message: string
    ) => Effect.Effect<string | null, GitOperationError>;
  }
>() {}

// ── Live implementation ────────────────────────────────────

export const GitServiceLive = Layer.effect(
  GitService,
  Effect.map(WorkspaceRoot, (ws) => {
    const reposDir = path.join(ws.path, ".createsuite", "repos");
    const reposConfigPath = path.join(
      ws.path,
      ".createsuite",
      "repos.json"
    );
    const workspaceGit = simpleGit(ws.path);

    // ── Internal helpers ─────────────────────────────────

    const readReposListSafe = (): Effect.Effect<RepoConfig[], never> =>
      Effect.tryPromise({
        try: async () => {
          const data = await fsp.readFile(reposConfigPath, "utf-8");
          const repos = JSON.parse(data) as RepoConfig[];
          return repos.map((r) => ({ ...r, clonedAt: new Date(r.clonedAt) }));
        },
        catch: () => [] as RepoConfig[],
      }).pipe(Effect.catchAll(() => Effect.succeed([] as RepoConfig[])));

    const writeReposList = (
      repos: RepoConfig[]
    ): Effect.Effect<void, FileWriteError> =>
      Effect.tryPromise({
        try: async () => {
          await fsp.mkdir(path.dirname(reposConfigPath), { recursive: true });
          await fsp.writeFile(
            reposConfigPath,
            JSON.stringify(repos, null, 2)
          );
        },
        catch: () =>
          new FileWriteError({
            path: reposConfigPath,
            message: `Failed to write repos config`,
          }),
      });

    const saveRepoConfig = (
      config: RepoConfig
    ): Effect.Effect<void, FileWriteError> =>
      Effect.gen(function* () {
        const repos = yield* readReposListSafe();
        const idx = repos.findIndex(
          (r) => r.owner === config.owner && r.name === config.name
        );
        if (idx >= 0) {
          repos[idx] = config;
        } else {
          repos.push(config);
        }
        yield* writeReposList(repos);
      });

    const wrapGit = <A>(
      operation: string,
      fn: () => Promise<A>
    ): Effect.Effect<A, GitOperationError> =>
      Effect.tryPromise({
        try: fn,
        catch: (err) =>
          new GitOperationError({
            operation,
            message: err instanceof Error ? err.message : String(err),
          }),
      });

    // ── Return the service ───────────────────────────────

    return {
      parseUrl: parseGitHubUrl,

      cloneRepo: (
        repoUrl: string,
        options: {
          depth?: number;
          branch?: string;
          githubToken?: string;
        } = {}
      ) =>
        Effect.gen(function* () {
          const { owner, name } = yield* parseGitHubUrl(repoUrl);
          const localPath = path.join(reposDir, owner, name);

          // If already cloned, pull latest
          if (fs.existsSync(path.join(localPath, ".git"))) {
            const git = simpleGit(localPath);
            yield* wrapGit("pull", () => git.pull());
            const existing = yield* readReposListSafe();
            const found = existing.find(
              (r) => r.owner === owner && r.name === name
            );
            if (found) return found;
          }

          // Ensure parent dir exists
          yield* Effect.tryPromise({
            try: () =>
              fsp.mkdir(path.join(reposDir, owner), { recursive: true }),
            catch: () =>
              new GitOperationError({
                operation: "mkdir",
                message: `Failed to create directory for ${owner}/${name}`,
              }),
          });

          // Build clone URL with token
          let cloneUrl = repoUrl;
          if (options.githubToken && repoUrl.startsWith("https://")) {
            cloneUrl = repoUrl.replace(
              "https://github.com/",
              `https://x-access-token:${options.githubToken}@github.com/`
            );
          }

          // Clone
          const cloneOpts: string[] = [];
          if (options.depth) cloneOpts.push(`--depth=${options.depth}`);
          if (options.branch) cloneOpts.push(`--branch=${options.branch}`);

          yield* wrapGit("clone", () =>
            simpleGit().clone(cloneUrl, localPath, cloneOpts)
          );

          // Configure
          const repoGit = simpleGit(localPath);
          const status = yield* wrapGit("status", () => repoGit.status());
          const defaultBranch = status.current || "main";

          yield* wrapGit("config-user", () =>
            repoGit.addConfig("user.name", "CreateSuite Agent")
          );
          yield* wrapGit("config-email", () =>
            repoGit.addConfig("user.email", "agent@createsuite.dev")
          );

          if (options.githubToken) {
            const pushUrl = repoUrl.replace(
              "https://github.com/",
              `https://x-access-token:${options.githubToken}@github.com/`
            );
            yield* wrapGit("set-push-url", () =>
              repoGit.remote(["set-url", "--push", "origin", pushUrl])
            );
          }

          const repoConfig: RepoConfig = {
            url: repoUrl,
            owner,
            name,
            localPath,
            defaultBranch,
            clonedAt: new Date(),
          };

          yield* saveRepoConfig(repoConfig);
          return repoConfig;
        }),

      createWorkBranch: (
        repoConfig: RepoConfig,
        agentId: string,
        taskId: string
      ) =>
        Effect.gen(function* () {
          const git = simpleGit(repoConfig.localPath);
          const branchName = `createsuite/${taskId}/${agentId.slice(0, 8)}`;

          yield* wrapGit("checkout-default", () =>
            git.checkout(repoConfig.defaultBranch)
          );
          yield* wrapGit("pull", () =>
            git.pull("origin", repoConfig.defaultBranch)
          ).pipe(Effect.catchAll(() => Effect.void));

          yield* wrapGit("create-branch", () =>
            git.checkoutLocalBranch(branchName)
          ).pipe(
            Effect.catchAll(() =>
              wrapGit("checkout-existing", () => git.checkout(branchName))
            )
          );

          return branchName;
        }),

      commitAndPush: (
        repoConfig: RepoConfig,
        branch: string,
        message: string
      ) =>
        Effect.gen(function* () {
          const git = simpleGit(repoConfig.localPath);

          yield* wrapGit("stage", () => git.add("-A"));
          const status = yield* wrapGit("status", () => git.status());

          if (status.isClean()) {
            return { pushed: false };
          }

          const commitResult = yield* wrapGit("commit", () =>
            git.commit(message)
          );
          const commitHash = commitResult.commit;

          const pushResult = yield* wrapGit("push", () =>
            git.push("origin", branch, ["--set-upstream"])
          ).pipe(
            Effect.map(() => ({ pushed: true, commitHash })),
            Effect.catchAll(() =>
              Effect.succeed({ pushed: false, commitHash })
            )
          );

          return pushResult;
        }),

      listRepos: () =>
        readReposListSafe() as Effect.Effect<
          ReadonlyArray<RepoConfig>,
          JsonParseError
        >,

      getRepo: (owner: string, name: string) =>
        Effect.gen(function* () {
          const repos = yield* readReposListSafe();
          const found = repos.find(
            (r) => r.owner === owner && r.name === name
          );
          return found ? Option.some(found) : Option.none<RepoConfig>();
        }),

      removeRepo: (owner: string, name: string) =>
        Effect.gen(function* () {
          const repos = yield* readReposListSafe();
          const filtered = repos.filter(
            (r) => !(r.owner === owner && r.name === name)
          );
          yield* writeReposList(filtered);

          const localPath = path.join(reposDir, owner, name);
          if (fs.existsSync(localPath)) {
            yield* Effect.tryPromise({
              try: () => fsp.rm(localPath, { recursive: true, force: true }),
              catch: () =>
                new GitOperationError({
                  operation: "removeRepo",
                  message: `Failed to remove ${localPath}`,
                }),
            });
          }
        }),

      // ── Workspace git (from GitIntegration) ───────────

      initWorkspaceGit: () =>
        Effect.gen(function* () {
          const isRepo = yield* wrapGit("checkIsRepo", () =>
            workspaceGit.checkIsRepo()
          );

          if (!isRepo) {
            yield* wrapGit("init", () => workspaceGit.init());

            const gitignorePath = path.join(ws.path, ".gitignore");
            if (!fs.existsSync(gitignorePath)) {
              const content = [
                "node_modules/",
                "dist/",
                "logs/",
                "*.log",
                ".DS_Store",
                "Thumbs.db",
                ".vscode/",
                ".idea/",
                "*.tmp",
                "*.temp",
              ].join("\n");
              fs.writeFileSync(gitignorePath, content);
            }

            yield* wrapGit("initial-commit", async () => {
              await workspaceGit.add(".");
              await workspaceGit.commit(
                "Initial commit: CreateSuite workspace setup"
              );
            });
          }
        }),

      commitTaskChanges: (message: string) =>
        Effect.gen(function* () {
          yield* wrapGit("stage-tasks", () =>
            workspaceGit.add(".createsuite/.")
          );
          const status = yield* wrapGit("status", () =>
            workspaceGit.status()
          );
          if (status.files.length > 0) {
            yield* wrapGit("commit", () => workspaceGit.commit(message));
          }
        }),

      getCurrentBranch: () =>
        Effect.gen(function* () {
          const status = yield* wrapGit("status", () =>
            workspaceGit.status()
          );
          return status.current || "main";
        }),

      switchToMain: () =>
        wrapGit("checkout-main", () => workspaceGit.checkout("main")).pipe(
          Effect.catchAll(() =>
            wrapGit("checkout-master", () =>
              workspaceGit.checkout("master")
            )
          ),
          Effect.asVoid
        ),

      isClean: () =>
        Effect.gen(function* () {
          const status = yield* wrapGit("status", () =>
            workspaceGit.status()
          );
          return status.isClean();
        }),

      commitAll: (message: string) =>
        Effect.gen(function* () {
          yield* wrapGit("stage-all", () => workspaceGit.add("-A"));
          const status = yield* wrapGit("status", () =>
            workspaceGit.status()
          );
          if (status.isClean()) return null;
          const result = yield* wrapGit("commit", () =>
            workspaceGit.commit(message)
          );
          return result.commit;
        }),
    };
  })
);
