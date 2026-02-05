import { RepoManager } from './repoManager';
import { PlanManager } from './planManager';
import { PRManager } from './prManager';
import { ConvoyManager } from './convoyManager';
import { TaskManager } from './taskManager';
import { AgentOrchestrator } from './agentOrchestrator';
import {
  PipelineConfig,
  PipelineStatus,
  PipelinePhase,
  ConvoyStatus,
  TaskStatus,
  AgentRuntime
} from './types';
import { v4 as uuidv4 } from 'uuid';
import * as fsp from 'fs/promises';
import * as path from 'path';

/**
 * Entrypoint — the top-level orchestrator for a full CreateSuite run.
 *
 * Usage:
 *   const entry = new Entrypoint(workspaceRoot);
 *   const result = await entry.start({
 *     repoUrl: 'https://github.com/user/repo',
 *     goal: 'Add comprehensive unit tests',
 *     provider: 'zai-coding-plan',
 *     model: 'glm-4.7',
 *     githubToken: process.env.GITHUB_TOKEN
 *   });
 *
 * Pipeline:
 *   1. Clone the target repo
 *   2. Create a plan (decompose goal into tasks + convoy)
 *   3. Assign agents and execute tasks
 *   4. Monitor progress until completion
 *   5. Commit and push agent work
 *   6. Open a GitHub PR
 *   7. Return PR URL
 */
export class Entrypoint {
  private workspaceRoot: string;
  private repoManager: RepoManager;
  private planManager: PlanManager;
  private prManager: PRManager;
  private convoyManager: ConvoyManager;
  private taskManager: TaskManager;
  private orchestrator: AgentOrchestrator;
  private statusPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.repoManager = new RepoManager(workspaceRoot);
    this.planManager = new PlanManager(workspaceRoot);
    this.prManager = new PRManager();
    this.convoyManager = new ConvoyManager(workspaceRoot);
    this.taskManager = new TaskManager(workspaceRoot);
    this.orchestrator = new AgentOrchestrator(workspaceRoot);
    this.statusPath = path.join(workspaceRoot, '.createsuite', 'pipeline-status.json');
  }

  /**
   * Run the full CreateSuite pipeline end-to-end.
   */
  async start(config: PipelineConfig): Promise<PipelineStatus> {
    const pipelineId = uuidv4().slice(0, 12);
    const status: PipelineStatus = {
      id: pipelineId,
      repoUrl: config.repoUrl,
      goal: config.goal,
      phase: PipelinePhase.CLONING,
      startedAt: new Date()
    };

    try {
      await this.saveStatus(status);

      // ── Phase 1: Clone the target repo ──
      console.log(`\n🔄 Phase 1: Cloning ${config.repoUrl}...`);
      status.phase = PipelinePhase.CLONING;
      await this.saveStatus(status);

      const repoConfig = await this.repoManager.cloneRepo(config.repoUrl, {
        githubToken: config.githubToken
      });
      console.log(`✓ Cloned to ${repoConfig.localPath}`);

      if (config.dryRun) {
        console.log('\n🏁 Dry run complete. Repo cloned, no work executed.');
        status.phase = PipelinePhase.COMPLETED;
        status.completedAt = new Date();
        await this.saveStatus(status);
        return status;
      }

      // ── Phase 2: Create plan ──
      console.log(`\n📋 Phase 2: Planning tasks for "${config.goal}"...`);
      status.phase = PipelinePhase.PLANNING;
      await this.saveStatus(status);

      const runtime = process.env.FLY_API_TOKEN ? AgentRuntime.FLY : AgentRuntime.LOCAL;
      const { plan, convoy, tasks } = await this.planManager.createPlan(
        config.goal,
        repoConfig,
        {
          maxAgents: config.maxAgents || 3,
          runtime,
          provider: config.provider
        }
      );
      status.convoyId = convoy.id;
      await this.saveStatus(status);
      console.log(`✓ Plan created: ${tasks.length} task(s) in convoy ${convoy.id}`);

      // ── Phase 3: Execute ──
      console.log(`\n⚡ Phase 3: Executing convoy ${convoy.id}...`);
      status.phase = PipelinePhase.EXECUTING;
      await this.saveStatus(status);

      await this.planManager.executePlan(convoy, repoConfig, {
        provider: config.provider,
        model: config.model,
        githubToken: config.githubToken
      });

      // Monitor progress
      await this.monitorConvoy(convoy.id, tasks.length);

      // ── Phase 4: Commit ──
      console.log(`\n💾 Phase 4: Committing agent work...`);
      status.phase = PipelinePhase.COMMITTING;
      await this.saveStatus(status);

      // Create a consolidated branch for all agent work
      const branchName = `createsuite/${convoy.id}`;
      await this.repoManager.createWorkBranch(repoConfig, 'consolidated', convoy.id);

      const commitResult = await this.repoManager.commitAndPush(
        repoConfig,
        branchName,
        `feat: ${config.goal}\n\nAutomated by CreateSuite\nConvoy: ${convoy.id}\nTasks: ${tasks.map(t => t.id).join(', ')}`
      );

      if (!commitResult.pushed) {
        console.log('ℹ No changes to push (agents may not have modified any files)');
        status.phase = PipelinePhase.COMPLETED;
        status.completedAt = new Date();
        await this.saveStatus(status);
        return status;
      }

      console.log(`✓ Pushed branch ${branchName} (${commitResult.commitHash})`);

      // ── Phase 5: Create PR ──
      console.log(`\n🔀 Phase 5: Creating pull request...`);
      status.phase = PipelinePhase.PR_CREATING;
      await this.saveStatus(status);

      if (config.githubToken) {
        this.prManager = new PRManager(config.githubToken);
      }

      const prBody = PRManager.buildPRBody({
        goal: config.goal,
        taskId: tasks.map(t => t.id).join(', '),
        agentName: `CreateSuite (${tasks.length} agent${tasks.length > 1 ? 's' : ''})`,
        convoyId: convoy.id,
        changes: tasks.map(t => t.title)
      });

      try {
        const pr = await this.prManager.createPR({
          repoConfig,
          branch: branchName,
          title: `[CreateSuite] ${config.goal}`,
          body: prBody
        });
        status.prUrl = pr.url;
        console.log(`✓ PR created: ${pr.url}`);
      } catch (prError: any) {
        console.log(`⚠ PR creation failed: ${prError.message}`);
        console.log('Branch was pushed — you can create the PR manually.');
      }

      // ── Done ──
      status.phase = PipelinePhase.COMPLETED;
      status.completedAt = new Date();
      await this.saveStatus(status);

      console.log(`\n🎉 Pipeline complete!`);
      console.log(`   Convoy: ${convoy.id}`);
      console.log(`   Tasks: ${tasks.length}`);
      console.log(`   Branch: ${branchName}`);
      if (status.prUrl) {
        console.log(`   PR: ${status.prUrl}`);
      }
      console.log(`   Duration: ${this.formatDuration(status.startedAt, status.completedAt)}`);

      return status;

    } catch (error: any) {
      status.phase = PipelinePhase.FAILED;
      status.error = error.message;
      status.completedAt = new Date();
      await this.saveStatus(status);

      console.error(`\n❌ Pipeline failed in phase ${status.phase}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the current pipeline status.
   */
  async getStatus(): Promise<PipelineStatus | null> {
    try {
      const data = await fsp.readFile(this.statusPath, 'utf-8');
      const status = JSON.parse(data);
      status.startedAt = new Date(status.startedAt);
      if (status.completedAt) status.completedAt = new Date(status.completedAt);
      return status;
    } catch {
      return null;
    }
  }

  // -- Private --

  private async monitorConvoy(convoyId: string, taskCount: number): Promise<void> {
    const maxWait = 10 * 60 * 1000; // 10 minutes max
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const progress = await this.convoyManager.getConvoyProgress(convoyId);

      if (progress.completed === progress.total && progress.total > 0) {
        console.log(`✓ All ${progress.total} tasks completed`);
        return;
      }

      console.log(
        `  Progress: ${progress.completed}/${progress.total} tasks ` +
        `(${progress.inProgress} in progress, ${progress.open} pending)`
      );

      await new Promise(r => setTimeout(r, pollInterval));
    }

    console.log('⚠ Monitoring timeout — checking final state...');
  }

  private async saveStatus(status: PipelineStatus): Promise<void> {
    const dir = path.dirname(this.statusPath);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(this.statusPath, JSON.stringify(status, null, 2));
  }

  private formatDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
