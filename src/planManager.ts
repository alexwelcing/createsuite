import { v4 as uuidv4 } from 'uuid';
import { TaskManager } from './taskManager';
import { ConvoyManager } from './convoyManager';
import { AgentOrchestrator } from './agentOrchestrator';
import { SmartRouter } from './smartRouter';
import { RepoManager } from './repoManager';
import {
  Task,
  TaskPriority,
  TaskStatus,
  AgentRuntime,
  Convoy,
  ConvoyStatus,
  RepoConfig,
  Plan,
  PlanTask
} from './types';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

/**
 * PlanManager — the orchestration brain of CreateSuite.
 *
 * Takes a high-level goal and a target repo, then:
 * 1. Analyzes the goal via SmartRouter
 * 2. Decomposes it into concrete tasks
 * 3. Creates a convoy grouping those tasks
 * 4. Assigns agents with matching capabilities
 * 5. Triggers execution (local or Fly.io)
 *
 * Plans are stored as markdown in .createsuite/plans/
 */
export class PlanManager {
  private workspaceRoot: string;
  private taskManager: TaskManager;
  private convoyManager: ConvoyManager;
  private orchestrator: AgentOrchestrator;
  private router: SmartRouter;
  private plansDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.taskManager = new TaskManager(workspaceRoot);
    this.convoyManager = new ConvoyManager(workspaceRoot);
    this.orchestrator = new AgentOrchestrator(workspaceRoot);
    this.router = new SmartRouter();
    this.plansDir = path.join(workspaceRoot, '.createsuite', 'plans');
  }

  /**
   * Create a plan from a high-level goal.
   * Decomposes the goal into tasks and groups them in a convoy.
   */
  async createPlan(
    goal: string,
    repoConfig: RepoConfig,
    options: {
      maxAgents?: number;
      runtime?: AgentRuntime;
      provider?: string;
    } = {}
  ): Promise<{ plan: Plan; convoy: Convoy; tasks: Task[] }> {
    const maxAgents = options.maxAgents || 3;
    const runtime = options.runtime || AgentRuntime.LOCAL;

    // 1. Analyze the goal
    const routerResult = this.router.route(goal);
    console.log(`Plan analysis: ${routerResult.reasoning}`);
    console.log(`Suggested skills: ${routerResult.suggestedSkills.join(', ')}`);
    console.log(`Estimated agents: ${Math.min(routerResult.estimatedAgents, maxAgents)}`);

    // 2. Decompose goal into subtasks
    const subtasks = this.decomposeGoal(goal, routerResult.suggestedSkills, repoConfig);
    console.log(`Decomposed into ${subtasks.length} subtask(s)`);

    // 3. Create tasks in the task manager
    const createdTasks: Task[] = [];
    for (const sub of subtasks) {
      const task = await this.taskManager.createTask(
        sub.title,
        sub.description,
        sub.priority,
        sub.tags
      );
      createdTasks.push(task);
    }

    // 4. Create a convoy for all tasks
    const convoy = await this.convoyManager.createConvoy(
      `Plan: ${goal.slice(0, 50)}`,
      `Auto-generated plan for: ${goal}\nRepo: ${repoConfig.url}`,
      createdTasks.map(t => t.id)
    );

    // 5. Create agents for each task (up to maxAgents)
    const agentCount = Math.min(createdTasks.length, maxAgents);
    const agents = [];
    for (let i = 0; i < agentCount; i++) {
      const task = createdTasks[i];
      const agentType = this.router.suggestAgentType(task.description);
      const agent = await this.orchestrator.createAgent(
        `${agentType}-${task.id}`,
        routerResult.suggestedSkills,
        { runtime }
      );
      agents.push({ agent, task, agentType });
    }

    // 6. If we have fewer agents than tasks, assign remaining tasks round-robin
    for (let i = agentCount; i < createdTasks.length; i++) {
      const agentIdx = i % agentCount;
      // Additional tasks will be queued for the same agents
      agents[agentIdx].task = createdTasks[i]; // Will be handled in execution
    }

    // 7. Save plan as markdown
    const plan = await this.savePlan(goal, repoConfig, convoy, createdTasks, agents);

    return { plan, convoy, tasks: createdTasks };
  }

  /**
   * Execute a plan — assign tasks to agents and kick off work.
   * For Fly.io runtime, this spawns containers.
   * For local runtime, this kicks off OpenCode terminals.
   */
  async executePlan(
    convoy: Convoy,
    repoConfig: RepoConfig,
    options: {
      provider?: string;
      model?: string;
      githubToken?: string;
    } = {}
  ): Promise<void> {
    const tasks = await Promise.all(
      convoy.tasks.map(id => this.taskManager.getTask(id))
    );
    const validTasks = tasks.filter((t): t is Task => t !== null);
    const agents = await this.orchestrator.listAgents();

    // Match tasks to agents and assign
    for (const task of validTasks) {
      // Find an idle agent
      const idleAgent = agents.find(a =>
        a.status === 'idle' && a.currentTask === undefined
      );

      if (idleAgent) {
        // Assign task
        await this.orchestrator.assignTaskToAgent(idleAgent.id, task.id);
        await this.taskManager.assignTask(task.id, idleAgent.id);

        console.log(`Assigned task ${task.id} ("${task.title}") to agent ${idleAgent.name}`);

        // Mark agent as no longer idle for next iteration
        idleAgent.status = 'working' as any;
        idleAgent.currentTask = task.id;
      } else {
        console.log(`No idle agent for task ${task.id} — will queue`);
      }
    }

    // Update convoy status
    await this.convoyManager.updateConvoyStatus(convoy.id, ConvoyStatus.ACTIVE);
  }

  /**
   * Decompose a high-level goal into concrete subtasks.
   * This is a rule-based decomposition — in the future this
   * could call the LLM (via OpenCode) for smarter decomposition.
   */
  private decomposeGoal(
    goal: string,
    suggestedSkills: string[],
    repoConfig: RepoConfig
  ): Array<{ title: string; description: string; priority: TaskPriority; tags: string[] }> {
    const lower = goal.toLowerCase();
    const subtasks: Array<{ title: string; description: string; priority: TaskPriority; tags: string[] }> = [];

    // Pattern: "add tests" / "improve test coverage"
    if (/test|coverage|spec/i.test(lower)) {
      subtasks.push({
        title: `Add unit tests for ${repoConfig.name}`,
        description: `Analyze ${repoConfig.name} source code and add comprehensive unit tests. Focus on critical paths and edge cases. Goal: ${goal}`,
        priority: TaskPriority.HIGH,
        tags: ['testing', 'automated']
      });
      if (/integration|e2e|end.to.end/i.test(lower)) {
        subtasks.push({
          title: `Add integration tests for ${repoConfig.name}`,
          description: `Add integration/E2E tests covering the main user workflows. Goal: ${goal}`,
          priority: TaskPriority.MEDIUM,
          tags: ['testing', 'integration', 'automated']
        });
      }
    }

    // Pattern: "refactor" / "restructure" / "clean up"
    if (/refactor|restructure|clean|organiz|simplif/i.test(lower)) {
      subtasks.push({
        title: `Refactor ${repoConfig.name} codebase`,
        description: `Review and refactor code for clarity, maintainability, and best practices. Goal: ${goal}`,
        priority: TaskPriority.MEDIUM,
        tags: ['refactor', 'automated']
      });
    }

    // Pattern: "fix bugs" / "fix issues"
    if (/fix|bug|issue|error|broken/i.test(lower)) {
      subtasks.push({
        title: `Fix issues in ${repoConfig.name}`,
        description: `Identify and fix bugs, lint errors, and broken functionality. Goal: ${goal}`,
        priority: TaskPriority.HIGH,
        tags: ['bugfix', 'automated']
      });
    }

    // Pattern: "document" / "add docs" / "improve readme"
    if (/document|readme|doc|guide|comment/i.test(lower)) {
      subtasks.push({
        title: `Improve documentation for ${repoConfig.name}`,
        description: `Add or improve documentation, README, code comments, and guides. Goal: ${goal}`,
        priority: TaskPriority.MEDIUM,
        tags: ['documentation', 'automated']
      });
    }

    // Pattern: "add feature" / "implement" / "build"
    if (/add|implement|build|create|feature|new/i.test(lower)) {
      subtasks.push({
        title: `Implement: ${goal.slice(0, 80)}`,
        description: `Implement the following in ${repoConfig.name}: ${goal}`,
        priority: TaskPriority.HIGH,
        tags: ['feature', 'automated']
      });
    }

    // Pattern: "performance" / "optimize"
    if (/performance|optimiz|speed|fast|slow/i.test(lower)) {
      subtasks.push({
        title: `Optimize performance in ${repoConfig.name}`,
        description: `Profile and optimize performance bottlenecks. Goal: ${goal}`,
        priority: TaskPriority.MEDIUM,
        tags: ['performance', 'automated']
      });
    }

    // Pattern: "security" / "vulnerability"
    if (/security|vulnerab|auth|permission|xss|injection/i.test(lower)) {
      subtasks.push({
        title: `Security review for ${repoConfig.name}`,
        description: `Audit code for security vulnerabilities and apply fixes. Goal: ${goal}`,
        priority: TaskPriority.CRITICAL,
        tags: ['security', 'automated']
      });
    }

    // If no patterns matched, create a single generic task
    if (subtasks.length === 0) {
      subtasks.push({
        title: goal.slice(0, 100),
        description: `Complete the following work on ${repoConfig.name}: ${goal}`,
        priority: TaskPriority.MEDIUM,
        tags: ['general', 'automated']
      });
    }

    return subtasks;
  }

  /**
   * Save plan as markdown and JSON in .createsuite/plans/
   */
  private async savePlan(
    goal: string,
    repoConfig: RepoConfig,
    convoy: Convoy,
    tasks: Task[],
    agents: Array<{ agent: any; task: Task; agentType: string }>
  ): Promise<Plan> {
    await fsp.mkdir(this.plansDir, { recursive: true });

    const planId = `plan-${Date.now()}`;
    const planPath = path.join(this.plansDir, `${planId}.md`);

    const lines = [
      `# Plan: ${goal}`,
      '',
      `**Repository:** ${repoConfig.url}`,
      `**Convoy:** ${convoy.id}`,
      `**Created:** ${new Date().toISOString()}`,
      '',
      '## Tasks',
      '',
    ];

    for (const task of tasks) {
      const agent = agents.find(a => a.task.id === task.id);
      lines.push(`- [ ] **${task.id}** — ${task.title}`);
      if (agent) {
        lines.push(`  - Agent: ${agent.agent.name} (${agent.agentType})`);
      }
      lines.push(`  - Priority: ${task.priority}`);
      lines.push(`  - Tags: ${task.tags.join(', ')}`);
      lines.push('');
    }

    const content = lines.join('\n');
    await fsp.writeFile(planPath, content);

    const plan: Plan = {
      name: goal,
      path: planPath,
      content,
      tasks: tasks.map((t, i) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        completed: false,
        lineNumber: 10 + i * 4 // Approximate
      })),
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    return plan;
  }

  /**
   * List all saved plans.
   */
  async listPlans(): Promise<string[]> {
    try {
      const files = await fsp.readdir(this.plansDir);
      return files.filter(f => f.endsWith('.md'));
    } catch {
      return [];
    }
  }

  /**
   * Load a plan by filename.
   */
  async loadPlan(filename: string): Promise<string> {
    const planPath = path.join(this.plansDir, filename);
    return fsp.readFile(planPath, 'utf-8');
  }
}
