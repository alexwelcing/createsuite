/**
 * Effect-based PR Service.
 *
 * Wraps the `gh` CLI (GitHub CLI) for creating and managing
 * pull requests. Each shell-out is wrapped in Effect with
 * typed errors (PRCreationError, CommandExecutionError).
 */
import { Context, Effect, Layer } from "effect";
import { exec } from "child_process";
import { promisify } from "util";
import type { RepoConfig } from "./schemas";
import { PRCreationError, CommandExecutionError } from "./errors";

const execAsync = promisify(exec);

// ── Service interface ──────────────────────────────────────

export class PRService extends Context.Tag("PRService")<
  PRService,
  {
    /** Create a pull request from an agent's work branch. */
    readonly createPR: (options: {
      repoConfig: RepoConfig;
      branch: string;
      title: string;
      body: string;
      baseBranch?: string;
      draft?: boolean;
      labels?: string[];
    }) => Effect.Effect<
      { url: string; number: number },
      PRCreationError | CommandExecutionError
    >;

    /** Find an existing PR for a branch. */
    readonly findExistingPR: (
      repoConfig: RepoConfig,
      branch: string
    ) => Effect.Effect<
      { url: string; number: number },
      PRCreationError | CommandExecutionError
    >;

    /** List PRs created by CreateSuite agents. */
    readonly listAgentPRs: (
      repoConfig: RepoConfig,
      state?: "open" | "closed" | "all"
    ) => Effect.Effect<
      ReadonlyArray<{
        number: number;
        title: string;
        url: string;
        state: string;
        branch: string;
      }>,
      CommandExecutionError
    >;

    /** Get PR status including CI checks. */
    readonly getPRStatus: (
      repoConfig: RepoConfig,
      prNumber: number
    ) => Effect.Effect<
      { state: string; mergeable: string; checks: string },
      CommandExecutionError
    >;

    /** Add a comment to a PR. */
    readonly commentOnPR: (
      repoConfig: RepoConfig,
      prNumber: number,
      body: string
    ) => Effect.Effect<void, CommandExecutionError>;

    /** Build a PR body with CreateSuite metadata. */
    readonly buildPRBody: (options: {
      goal: string;
      taskId: string;
      agentName: string;
      convoyId?: string;
      changes?: string[];
    }) => string;
  }
>() {}

// ── Live implementation ────────────────────────────────────

export const PRServiceLive = (
  githubToken?: string
): Layer.Layer<PRService> => {
  const token = githubToken || process.env.GITHUB_TOKEN;

  const buildEnv = (): NodeJS.ProcessEnv => ({
    ...process.env,
    ...(token && { GITHUB_TOKEN: token }),
    GH_TOKEN: token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
  });

  const extractPRNumber = (prUrl: string): number => {
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const runGh = <A>(
    cmd: string,
    cwd: string,
    parse: (stdout: string) => A
  ): Effect.Effect<A, CommandExecutionError> =>
    Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync(cmd, { cwd, env: buildEnv() });
        return parse(stdout);
      },
      catch: (err) =>
        new CommandExecutionError({
          command: cmd.slice(0, 80),
          message: err instanceof Error ? err.message : String(err),
        }),
    });

  return Layer.succeed(PRService, {
    createPR: (options) => {
        const {
          repoConfig,
          branch,
          title,
          body,
          baseBranch,
          draft = false,
          labels = ["createsuite", "automated"],
        } = options;

        const base = baseBranch || repoConfig.defaultBranch;
        const repo = `${repoConfig.owner}/${repoConfig.name}`;

        const args = [
          "gh",
          "pr",
          "create",
          "--repo",
          repo,
          "--head",
          branch,
          "--base",
          base,
          "--title",
          JSON.stringify(title),
          "--body",
          JSON.stringify(body),
        ];

        if (draft) args.push("--draft");
        for (const label of labels) {
          args.push("--label", label);
        }

        const cmd = args.join(" ");

        return Effect.tryPromise({
          try: async () => {
            const { stdout } = await execAsync(cmd, {
              cwd: repoConfig.localPath,
              env: buildEnv(),
            });
            const prUrl = stdout.trim();
            return { url: prUrl, number: extractPRNumber(prUrl) };
          },
          catch: (err: any) =>
            new PRCreationError({
              message: err?.stderr?.includes("already exists")
                ? "PR_EXISTS"
                : err instanceof Error
                  ? err.message
                  : String(err),
            }),
        }).pipe(
          Effect.catchTag("PRCreationError", (e) =>
            e.message === "PR_EXISTS"
              ? runGh(
                  `gh pr list --repo ${repo} --head ${branch} --json number,url --limit 1`,
                  repoConfig.localPath,
                  (stdout) => {
                    const prs = JSON.parse(stdout);
                    if (prs.length === 0) {
                      throw new Error(`No PR found for branch ${branch}`);
                    }
                    return {
                      url: prs[0].url as string,
                      number: prs[0].number as number,
                    };
                  }
                ).pipe(
                  Effect.mapError(
                    () =>
                      new PRCreationError({
                        message: `PR exists but could not be found`,
                      })
                  )
                )
              : Effect.fail(e)
          )
        );
      },

    findExistingPR: (repoConfig, branch) => {
      const repo = `${repoConfig.owner}/${repoConfig.name}`;
      return runGh(
        `gh pr list --repo ${repo} --head ${branch} --json number,url --limit 1`,
        repoConfig.localPath,
        (stdout) => {
          const prs = JSON.parse(stdout);
          if (prs.length === 0) {
            throw new Error(`No PR found for branch ${branch}`);
          }
          return { url: prs[0].url as string, number: prs[0].number as number };
        }
      ).pipe(
        Effect.mapError((e) =>
          e._tag === "CommandExecutionError"
            ? e
            : new PRCreationError({ message: e.message })
        )
      ) as Effect.Effect<
        { url: string; number: number },
        PRCreationError | CommandExecutionError
      >;
    },

    listAgentPRs: (repoConfig, state = "open") => {
      const repo = `${repoConfig.owner}/${repoConfig.name}`;
      return runGh(
        `gh pr list --repo ${repo} --state ${state} --label createsuite --json number,title,url,state,headRefName --limit 50`,
        repoConfig.localPath,
        (stdout) => {
          const prs = JSON.parse(stdout);
          return prs.map((pr: any) => ({
            number: pr.number,
            title: pr.title,
            url: pr.url,
            state: pr.state,
            branch: pr.headRefName,
          }));
        }
      );
    },

    getPRStatus: (repoConfig, prNumber) => {
      const repo = `${repoConfig.owner}/${repoConfig.name}`;
      return runGh(
        `gh pr view ${prNumber} --repo ${repo} --json state,mergeable,statusCheckRollup`,
        repoConfig.localPath,
        (stdout) => {
          const data = JSON.parse(stdout);
          return {
            state: data.state,
            mergeable: data.mergeable,
            checks:
              data.statusCheckRollup?.length > 0
                ? data.statusCheckRollup
                    .map(
                      (c: any) => `${c.name}: ${c.conclusion || c.status}`
                    )
                    .join(", ")
                : "none",
          };
        }
      );
    },

    commentOnPR: (repoConfig, prNumber, body) => {
      const repo = `${repoConfig.owner}/${repoConfig.name}`;
      return runGh(
        `gh pr comment ${prNumber} --repo ${repo} --body ${JSON.stringify(body)}`,
        repoConfig.localPath,
        () => undefined
      ).pipe(Effect.asVoid);
    },

    buildPRBody: (options) => {
      const lines = [
        "## CreateSuite Agent Work",
        "",
        `**Goal:** ${options.goal}`,
        `**Task:** \`${options.taskId}\``,
        `**Agent:** ${options.agentName}`,
      ];

      if (options.convoyId) {
        lines.push(`**Convoy:** \`${options.convoyId}\``);
      }

      lines.push("", "---", "");

      if (options.changes && options.changes.length > 0) {
        lines.push("### Changes Made", "");
        for (const change of options.changes) {
          lines.push(`- ${change}`);
        }
        lines.push("");
      }

      lines.push(
        "---",
        "",
        "*This PR was automatically created by [CreateSuite](https://github.com/awelcing-alm/createsuite) agents.*"
      );

      return lines.join("\n");
    },
  });
};
