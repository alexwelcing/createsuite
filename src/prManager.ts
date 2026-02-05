import { exec } from 'child_process';
import { promisify } from 'util';
import { RepoConfig } from './types';

const execAsync = promisify(exec);

/**
 * Manages GitHub Pull Request creation and tracking.
 * Uses the `gh` CLI (GitHub CLI) which is available in the dev container
 * and in Fly.io containers where GITHUB_TOKEN is set.
 */
export class PRManager {
  private githubToken?: string;

  constructor(githubToken?: string) {
    this.githubToken = githubToken || process.env.GITHUB_TOKEN;
  }

  /**
   * Create a pull request from an agent's work branch.
   * Returns the PR URL on success.
   */
  async createPR(options: {
    repoConfig: RepoConfig;
    branch: string;
    title: string;
    body: string;
    baseBranch?: string;
    draft?: boolean;
    labels?: string[];
  }): Promise<{ url: string; number: number }> {
    const {
      repoConfig,
      branch,
      title,
      body,
      baseBranch,
      draft = false,
      labels = ['createsuite', 'automated']
    } = options;

    const base = baseBranch || repoConfig.defaultBranch;
    const repo = `${repoConfig.owner}/${repoConfig.name}`;

    const args = [
      'gh', 'pr', 'create',
      '--repo', repo,
      '--head', branch,
      '--base', base,
      '--title', JSON.stringify(title),
      '--body', JSON.stringify(body),
    ];

    if (draft) {
      args.push('--draft');
    }

    for (const label of labels) {
      args.push('--label', label);
    }

    const env = this.buildEnv();
    const cmd = args.join(' ');

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: repoConfig.localPath,
        env
      });

      const prUrl = stdout.trim();
      const prNumber = this.extractPRNumber(prUrl);

      console.log(`PR created: ${prUrl}`);
      return { url: prUrl, number: prNumber };
    } catch (error: any) {
      // If PR already exists, try to find it
      if (error.stderr?.includes('already exists')) {
        return this.findExistingPR(repoConfig, branch);
      }
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  /**
   * Find an existing PR for a branch.
   */
  async findExistingPR(
    repoConfig: RepoConfig,
    branch: string
  ): Promise<{ url: string; number: number }> {
    const repo = `${repoConfig.owner}/${repoConfig.name}`;
    const env = this.buildEnv();

    const { stdout } = await execAsync(
      `gh pr list --repo ${repo} --head ${branch} --json number,url --limit 1`,
      { cwd: repoConfig.localPath, env }
    );

    const prs = JSON.parse(stdout);
    if (prs.length === 0) {
      throw new Error(`No PR found for branch ${branch}`);
    }

    return { url: prs[0].url, number: prs[0].number };
  }

  /**
   * List PRs created by CreateSuite agents.
   */
  async listAgentPRs(
    repoConfig: RepoConfig,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<Array<{ number: number; title: string; url: string; state: string; branch: string }>> {
    const repo = `${repoConfig.owner}/${repoConfig.name}`;
    const env = this.buildEnv();

    const { stdout } = await execAsync(
      `gh pr list --repo ${repo} --state ${state} --label createsuite --json number,title,url,state,headRefName --limit 50`,
      { cwd: repoConfig.localPath, env }
    );

    const prs = JSON.parse(stdout);
    return prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      branch: pr.headRefName
    }));
  }

  /**
   * Get PR status including CI checks.
   */
  async getPRStatus(
    repoConfig: RepoConfig,
    prNumber: number
  ): Promise<{ state: string; mergeable: string; checks: string }> {
    const repo = `${repoConfig.owner}/${repoConfig.name}`;
    const env = this.buildEnv();

    const { stdout } = await execAsync(
      `gh pr view ${prNumber} --repo ${repo} --json state,mergeable,statusCheckRollup`,
      { cwd: repoConfig.localPath, env }
    );

    const data = JSON.parse(stdout);
    return {
      state: data.state,
      mergeable: data.mergeable,
      checks: data.statusCheckRollup?.length > 0
        ? data.statusCheckRollup.map((c: any) => `${c.name}: ${c.conclusion || c.status}`).join(', ')
        : 'none'
    };
  }

  /**
   * Add a comment to a PR.
   */
  async commentOnPR(
    repoConfig: RepoConfig,
    prNumber: number,
    body: string
  ): Promise<void> {
    const repo = `${repoConfig.owner}/${repoConfig.name}`;
    const env = this.buildEnv();

    await execAsync(
      `gh pr comment ${prNumber} --repo ${repo} --body ${JSON.stringify(body)}`,
      { cwd: repoConfig.localPath, env }
    );
  }

  /**
   * Build a PR body with CreateSuite metadata.
   */
  static buildPRBody(options: {
    goal: string;
    taskId: string;
    agentName: string;
    convoyId?: string;
    changes?: string[];
  }): string {
    const lines = [
      '## CreateSuite Agent Work',
      '',
      `**Goal:** ${options.goal}`,
      `**Task:** \`${options.taskId}\``,
      `**Agent:** ${options.agentName}`,
    ];

    if (options.convoyId) {
      lines.push(`**Convoy:** \`${options.convoyId}\``);
    }

    lines.push('', '---', '');

    if (options.changes && options.changes.length > 0) {
      lines.push('### Changes Made', '');
      for (const change of options.changes) {
        lines.push(`- ${change}`);
      }
      lines.push('');
    }

    lines.push(
      '---',
      '',
      '*This PR was automatically created by [CreateSuite](https://github.com/awelcing-alm/createsuite) agents.*'
    );

    return lines.join('\n');
  }

  // -- Private helpers --

  private buildEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ...(this.githubToken && { GITHUB_TOKEN: this.githubToken }),
      GH_TOKEN: this.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''
    };
  }

  private extractPRNumber(prUrl: string): number {
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
