import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { RepoConfig } from './types';
import { ConfigManager } from './config';

/**
 * Manages target repository lifecycle:
 * - Clone a GitHub repo into the workspace
 * - Create working branches for agents
 * - Push agent work back to origin
 * - Track cloned repos in .createsuite/repos.json
 */
export class RepoManager {
  private workspaceRoot: string;
  private configManager: ConfigManager;
  private reposDir: string;
  private reposConfigPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.configManager = new ConfigManager(workspaceRoot);
    this.reposDir = path.join(workspaceRoot, '.createsuite', 'repos');
    this.reposConfigPath = path.join(workspaceRoot, '.createsuite', 'repos.json');
  }

  /**
   * Parse a GitHub URL into owner and repo name.
   * Supports: https://github.com/owner/repo, https://github.com/owner/repo.git,
   * git@github.com:owner/repo.git
   */
  static parseGitHubUrl(url: string): { owner: string; name: string } {
    // HTTPS format
    const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], name: httpsMatch[2] };
    }
    // SSH format
    const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], name: sshMatch[2] };
    }
    throw new Error(`Cannot parse GitHub URL: ${url}. Expected format: https://github.com/owner/repo`);
  }

  /**
   * Clone a GitHub repository into the workspace.
   * Returns the RepoConfig for the cloned repo.
   */
  async cloneRepo(repoUrl: string, options: {
    depth?: number;
    branch?: string;
    githubToken?: string;
  } = {}): Promise<RepoConfig> {
    const { owner, name } = RepoManager.parseGitHubUrl(repoUrl);
    const localPath = path.join(this.reposDir, owner, name);

    // If already cloned, pull latest
    if (fs.existsSync(path.join(localPath, '.git'))) {
      console.log(`Repository ${owner}/${name} already cloned. Pulling latest...`);
      const git = simpleGit(localPath);
      await git.pull();
      const config = await this.loadRepoConfig(owner, name);
      if (config) return config;
    }

    // Ensure parent directory exists
    await fsp.mkdir(path.join(this.reposDir, owner), { recursive: true });

    // Build clone URL with token if provided
    let cloneUrl = repoUrl;
    if (options.githubToken && repoUrl.startsWith('https://')) {
      cloneUrl = repoUrl.replace(
        'https://github.com/',
        `https://x-access-token:${options.githubToken}@github.com/`
      );
    }

    // Clone
    console.log(`Cloning ${owner}/${name}...`);
    const cloneOpts: string[] = [];
    if (options.depth) {
      cloneOpts.push(`--depth=${options.depth}`);
    }
    if (options.branch) {
      cloneOpts.push(`--branch=${options.branch}`);
    }

    const git = simpleGit();
    await git.clone(cloneUrl, localPath, cloneOpts);

    // Detect default branch
    const repoGit = simpleGit(localPath);
    const status = await repoGit.status();
    const defaultBranch = status.current || 'main';

    // Configure git user for agent commits
    await repoGit.addConfig('user.name', 'CreateSuite Agent');
    await repoGit.addConfig('user.email', 'agent@createsuite.dev');

    // If we used a token-embedded URL, set the push remote to the token URL
    // so agents can push without additional auth
    if (options.githubToken) {
      const pushUrl = repoUrl.replace(
        'https://github.com/',
        `https://x-access-token:${options.githubToken}@github.com/`
      );
      await repoGit.remote(['set-url', '--push', 'origin', pushUrl]);
    }

    const repoConfig: RepoConfig = {
      url: repoUrl,
      owner,
      name,
      localPath,
      defaultBranch,
      clonedAt: new Date()
    };

    await this.saveRepoConfig(repoConfig);
    console.log(`Cloned ${owner}/${name} to ${localPath}`);
    return repoConfig;
  }

  /**
   * Create a working branch for an agent task.
   * Returns the branch name.
   */
  async createWorkBranch(
    repoConfig: RepoConfig,
    agentId: string,
    taskId: string
  ): Promise<string> {
    const git = simpleGit(repoConfig.localPath);
    const branchName = `createsuite/${taskId}/${agentId.slice(0, 8)}`;

    // Start from the default branch
    await git.checkout(repoConfig.defaultBranch);
    await git.pull('origin', repoConfig.defaultBranch).catch(() => {
      // Pull may fail if no remote — that's okay for local-only repos
    });

    // Create and switch to the work branch
    try {
      await git.checkoutLocalBranch(branchName);
    } catch {
      // Branch may already exist
      await git.checkout(branchName);
    }

    return branchName;
  }

  /**
   * Commit all changes in the repo and push the branch.
   */
  async commitAndPush(
    repoConfig: RepoConfig,
    branch: string,
    message: string
  ): Promise<{ pushed: boolean; commitHash?: string }> {
    const git = simpleGit(repoConfig.localPath);

    // Stage all changes
    await git.add('-A');

    // Check if there are changes
    const status = await git.status();
    if (status.isClean()) {
      return { pushed: false };
    }

    // Commit
    const commitResult = await git.commit(message);
    const commitHash = commitResult.commit;

    // Push
    try {
      await git.push('origin', branch, ['--set-upstream']);
      return { pushed: true, commitHash };
    } catch (error) {
      console.error(`Push failed for branch ${branch}:`, error);
      return { pushed: false, commitHash };
    }
  }

  /**
   * Get the git instance for a cloned repo.
   */
  getGit(repoConfig: RepoConfig): SimpleGit {
    return simpleGit(repoConfig.localPath);
  }

  /**
   * List all cloned repos.
   */
  async listRepos(): Promise<RepoConfig[]> {
    try {
      const data = await fsp.readFile(this.reposConfigPath, 'utf-8');
      const repos: RepoConfig[] = JSON.parse(data);
      return repos.map(r => ({ ...r, clonedAt: new Date(r.clonedAt) }));
    } catch {
      return [];
    }
  }

  /**
   * Get a specific cloned repo by owner/name.
   */
  async getRepo(owner: string, name: string): Promise<RepoConfig | null> {
    const repos = await this.listRepos();
    return repos.find(r => r.owner === owner && r.name === name) || null;
  }

  /**
   * Remove a cloned repo.
   */
  async removeRepo(owner: string, name: string): Promise<void> {
    const repos = await this.listRepos();
    const filtered = repos.filter(r => !(r.owner === owner && r.name === name));
    await fsp.writeFile(this.reposConfigPath, JSON.stringify(filtered, null, 2));

    const localPath = path.join(this.reposDir, owner, name);
    if (fs.existsSync(localPath)) {
      await fsp.rm(localPath, { recursive: true, force: true });
    }
  }

  // -- Private helpers --

  private async saveRepoConfig(config: RepoConfig): Promise<void> {
    const repos = await this.listRepos();
    const existing = repos.findIndex(r => r.owner === config.owner && r.name === config.name);
    if (existing >= 0) {
      repos[existing] = config;
    } else {
      repos.push(config);
    }
    await fsp.mkdir(path.dirname(this.reposConfigPath), { recursive: true });
    await fsp.writeFile(this.reposConfigPath, JSON.stringify(repos, null, 2));
  }

  private async loadRepoConfig(owner: string, name: string): Promise<RepoConfig | null> {
    return this.getRepo(owner, name);
  }
}
