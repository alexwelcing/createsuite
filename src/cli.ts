#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Effect } from 'effect';
import {
  AppLayer,
  ConfigService,
  TaskService,
  ConvoyService,
  RouterService,
  GitService,
  PRService,
  AgentService,
  PlanService,
  PipelineService,
} from './effect';
// Legacy imports retained for provider/oauth (not yet converted)
import { OAuthManager } from './oauthManager';
import { ProviderManager } from './providerManager';
import type { TaskStatus, TaskPriority, AgentRuntime } from './effect/schemas';

const execAsync = promisify(exec);
const VALID_AGENT_RUNTIMES = ['local', 'fly'];

const program = new Command();

// Get workspace root (current directory by default)
const getWorkspaceRoot = (): string => {
  return process.cwd();
};

/** Run an Effect program with the full AppLayer. */
const run = <A>(
  effect: Effect.Effect<A, any, any>,
  opts?: { githubToken?: string }
): Promise<A> => {
  const cwd = getWorkspaceRoot();
  return Effect.runPromise(
    effect.pipe(Effect.provide(AppLayer(cwd, opts))) as Effect.Effect<A, any, never>
  );
};

program
  .name('createsuite')
  .description('Orchestrated swarm system for OpenCode agents with git-based task tracking')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize a new CreateSuite workspace')
  .option('-n, --name <name>', 'Workspace name')
  .option('-r, --repo <url>', 'Git repository URL')
  .option('--git', 'Initialize git repository')
  .option('--skip-providers', 'Skip provider setup')
  .action(async (options) => {
    const workspaceRoot = getWorkspaceRoot();
    const name = options.name || path.basename(workspaceRoot);
    
    console.log(chalk.blue('Initializing CreateSuite workspace...'));
    
    await run(Effect.gen(function* () {
      const config = yield* ConfigService;
      yield* config.initialize(name, options.repo);
      
      if (options.git) {
        const git = yield* GitService;
        yield* git.initWorkspaceGit();
        console.log(chalk.green('✓ Git repository initialized'));
      }
    }));
    
    console.log(chalk.green(`✓ Workspace "${name}" initialized at ${workspaceRoot}`));
    
    // Prompt for provider setup
    if (!options.skipProviders) {
      console.log(chalk.bold.cyan('\n🚀 Let\'s set up your AI model providers!\n'));
      console.log(chalk.gray('CreateSuite uses OpenCode and oh-my-opencode for advanced agent orchestration.'));
      console.log(chalk.gray('This will configure connections to Z.ai, Claude, OpenAI, MiniMax, and more.\n'));
      
      const inquirer = (await import('inquirer')).default;
      const { setupProviders } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupProviders',
          message: 'Would you like to set up your AI providers now?',
          default: true
        }
      ]);
      
      if (setupProviders) {
        const providerManager = new ProviderManager(workspaceRoot);
        await providerManager.setupProviders();
      } else {
        console.log(chalk.gray('\nYou can set up providers later by running:'));
        console.log(chalk.blue('  cs provider setup\n'));
      }
    }
    
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  cs agent create <name>  - Create an agent'));
    console.log(chalk.gray('  cs task create          - Create a task'));
    console.log(chalk.gray('  cs convoy create        - Create a convoy'));
    console.log(chalk.gray('  cs provider setup       - Configure AI providers'));
  });

// Task commands
const taskCmd = program.command('task').description('Manage tasks');

taskCmd
  .command('create')
  .description('Create a new task')
  .option('-t, --title <title>', 'Task title')
  .option('-d, --description <desc>', 'Task description')
  .option('-p, --priority <priority>', 'Priority (low|medium|high|critical)', 'medium')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(async (options) => {
    const title = options.title || 'New Task';
    const description = options.description || '';
    const priority = options.priority as TaskPriority;
    const tags = options.tags ? options.tags.split(',') : [];
    
    const { task, routingResult } = await run(Effect.gen(function* () {
      const taskService = yield* TaskService;
      const routerService = yield* RouterService;
      const gitService = yield* GitService;
      
      const fullDescription = `${title} ${description}`.trim();
      const result = routerService.route(fullDescription);
      
      const t = yield* taskService.createTask(title, description, priority, tags);
      yield* gitService.commitTaskChanges(`Created task: ${t.id} - ${t.title}`);
      
      return { task: t, routingResult: result };
    }));
    
    console.log(chalk.green(`✓ Task created: ${task.id}`));
    console.log(chalk.gray(`  Title: ${task.title}`));
    console.log(chalk.gray(`  Priority: ${task.priority}`));
    console.log();
    console.log(chalk.cyan('🎯 Workflow Analysis:'));
    console.log(chalk.gray(`  Recommended: ${routingResult.recommended.toUpperCase()}`));
    console.log(chalk.gray(`  Confidence: ${Math.round(routingResult.confidence * 100)}%`));
    console.log(chalk.gray(`  Reasoning: ${routingResult.reasoning}`));
    
    if (routingResult.recommended === 'complex' || routingResult.recommended === 'team') {
      console.log();
      console.log(chalk.yellow('💡 This task may require planning. Consider:'));
      console.log(chalk.gray('   - cs plan create <name> to break down the work'));
      console.log(chalk.gray('   - cs convoy create <name> to coordinate multiple agents'));
    }
  });

taskCmd
  .command('list')
  .description('List all tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('-a, --agent <agentId>', 'Filter by assigned agent')
  .action(async (options) => {
    const filters: {
      status?: TaskStatus;
      assignedAgent?: string;
      priority?: TaskPriority;
    } = {};
    if (options.status) filters.status = options.status;
    if (options.agent) filters.assignedAgent = options.agent;
    
    const tasks = await run(Effect.gen(function* () {
      const taskService = yield* TaskService;
      return yield* taskService.listTasks(filters);
    }));
    
    if (tasks.length === 0) {
      console.log(chalk.yellow('No tasks found'));
      return;
    }
    
    console.log(chalk.blue(`\nFound ${tasks.length} task(s):\n`));
    for (const task of tasks) {
      const statusColor = 
        task.status === 'completed' ? chalk.green :
        task.status === 'in_progress' ? chalk.yellow :
        task.status === 'blocked' ? chalk.red :
        chalk.gray;
      
      console.log(`${chalk.bold(task.id)} - ${task.title}`);
      console.log(`  Status: ${statusColor(task.status)}`);
      console.log(`  Priority: ${task.priority}`);
      if (task.assignedAgent) {
        console.log(`  Assigned to: ${task.assignedAgent}`);
      }
      console.log('');
    }
  });

taskCmd
  .command('show <taskId>')
  .description('Show task details')
  .action(async (taskId) => {
    const { Option } = await import('effect');
    const taskOpt = await run(Effect.gen(function* () {
      const taskService = yield* TaskService;
      return yield* taskService.getTask(taskId);
    }));
    
    if (Option.isNone(taskOpt)) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      return;
    }
    const task = taskOpt.value;
    
    console.log(chalk.blue(`\nTask: ${task.id}\n`));
    console.log(`Title: ${task.title}`);
    console.log(`Description: ${task.description}`);
    console.log(`Status: ${task.status}`);
    console.log(`Priority: ${task.priority}`);
    if (task.assignedAgent) {
      console.log(`Assigned to: ${task.assignedAgent}`);
    }
    console.log(`Created: ${task.createdAt.toISOString()}`);
    console.log(`Updated: ${task.updatedAt.toISOString()}`);
    if (task.tags.length > 0) {
      console.log(`Tags: ${task.tags.join(', ')}`);
    }
  });

// Agent commands
const agentCmd = program.command('agent').description('Manage agents');

agentCmd
  .command('create')
  .description('Create a new agent')
  .argument('<name>', 'Agent name')
  .option('-c, --capabilities <caps>', 'Comma-separated capabilities')
  .option('--runtime <runtime>', 'Agent runtime (local|fly)')
  .option('--fly-app <name>', 'Fly app name for this agent (implies runtime fly)')
  .action(async (name, options) => {
    const capabilities = options.capabilities ? options.capabilities.split(',') : ['general'];
    const runtimeInput = options.runtime ? options.runtime.toLowerCase() : undefined;
    if (runtimeInput && !VALID_AGENT_RUNTIMES.includes(runtimeInput)) {
      console.log(chalk.red(`Invalid runtime: ${runtimeInput}. Use ${VALID_AGENT_RUNTIMES.join(' or ')}.`));
      return;
    }
    if (options.flyApp && runtimeInput === 'local') {
      console.log(chalk.red('fly-app cannot be used with local runtime.'));
      return;
    }
    let runtime: AgentRuntime | undefined;
    if (runtimeInput === 'fly' || options.flyApp) {
      runtime = 'fly';
    } else if (runtimeInput === 'local') {
      runtime = 'local';
    }
    
    const agent = await run(Effect.gen(function* () {
      const agentService = yield* AgentService;
      const gitService = yield* GitService;
      const a = yield* agentService.createAgent(name, capabilities, {
        runtime,
        flyAppName: options.flyApp
      });
      yield* gitService.commitTaskChanges(`Created agent: ${a.name} (${a.id})`);
      return a;
    }));
    
    console.log(chalk.green(`✓ Agent created: ${agent.name}`));
    console.log(chalk.gray(`  ID: ${agent.id}`));
    console.log(chalk.gray(`  Capabilities: ${agent.capabilities.join(', ')}`));
    console.log(chalk.gray(`  Runtime: ${agent.runtime}`));
    if (agent.flyAppName) {
      console.log(chalk.gray(`  Fly app: ${agent.flyAppName}`));
    }
  });

agentCmd
  .command('list')
  .description('List all agents')
  .action(async () => {
    const agents = await run(Effect.gen(function* () {
      const agentService = yield* AgentService;
      return yield* agentService.listAgents();
    }));
    
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents found'));
      return;
    }
    
    console.log(chalk.blue(`\nFound ${agents.length} agent(s):\n`));
    for (const agent of agents) {
      const statusColor = 
        agent.status === 'working' ? chalk.green :
        agent.status === 'idle' ? chalk.yellow :
        agent.status === 'error' ? chalk.red :
        chalk.gray;
      
      console.log(`${chalk.bold(agent.name)} (${agent.id})`);
      console.log(`  Status: ${statusColor(agent.status)}`);
      console.log(`  Runtime: ${agent.runtime}`);
      if (agent.flyAppName) {
        console.log(`  Fly app: ${agent.flyAppName}`);
      }
      if (agent.currentTask) {
        console.log(`  Current task: ${agent.currentTask}`);
      }
      console.log(`  Capabilities: ${agent.capabilities.join(', ')}`);
      console.log('');
    }
  });

agentCmd
  .command('assign <taskId> <agentId>')
  .description('Assign a task to an agent')
  .action(async (taskId, agentId) => {
    await run(Effect.gen(function* () {
      const agentService = yield* AgentService;
      const taskService = yield* TaskService;
      const gitService = yield* GitService;
      
      yield* agentService.assignTaskToAgent(agentId, taskId, getWorkspaceRoot());
      yield* taskService.assignTask(taskId, agentId);
      yield* gitService.commitTaskChanges(`Assigned task ${taskId} to agent ${agentId}`);
    }));
    
    console.log(chalk.green(`✓ Task ${taskId} assigned to agent ${agentId}`));
  });

// Convoy commands
const convoyCmd = program.command('convoy').description('Manage convoys (task groups)');

convoyCmd
  .command('create')
  .description('Create a new convoy')
  .argument('<name>', 'Convoy name')
  .option('-d, --description <desc>', 'Convoy description')
  .option('-t, --tasks <tasks>', 'Comma-separated task IDs')
  .action(async (name, options) => {
    const description = options.description || '';
    const taskIds = options.tasks ? options.tasks.split(',') : [];
    
    const convoy = await run(Effect.gen(function* () {
      const convoyService = yield* ConvoyService;
      const gitService = yield* GitService;
      
      const c = yield* convoyService.createConvoy(name, description, taskIds);
      yield* gitService.commitTaskChanges(`Created convoy: ${c.id} - ${c.name}`);
      return c;
    }));
    
    console.log(chalk.green(`✓ Convoy created: ${convoy.id}`));
    console.log(chalk.gray(`  Name: ${convoy.name}`));
    console.log(chalk.gray(`  Tasks: ${convoy.tasks.length}`));
  });

convoyCmd
  .command('list')
  .description('List all convoys')
  .option('-s, --status <status>', 'Filter by status')
  .action(async (_options) => {
    const convoys = await run(Effect.gen(function* () {
      const convoyService = yield* ConvoyService;
      return yield* convoyService.listConvoys();
    }));
    
    if (convoys.length === 0) {
      console.log(chalk.yellow('No convoys found'));
      return;
    }
    
    console.log(chalk.blue(`\nFound ${convoys.length} convoy(s):\n`));
    for (const convoy of convoys) {
      const progress = await run(Effect.gen(function* () {
        const convoyService = yield* ConvoyService;
        return yield* convoyService.getProgress(convoy.id);
      }));
      
      console.log(`${chalk.bold(convoy.id)} - ${convoy.name}`);
      console.log(`  Status: ${convoy.status}`);
      console.log(`  Tasks: ${convoy.tasks.length}`);
      console.log(`  Progress: ${progress.completed}/${progress.total} (${progress.percentComplete}%)`);
      console.log('');
    }
  });

convoyCmd
  .command('show <convoyId>')
  .description('Show convoy details')
  .action(async (convoyId) => {
    const { Option } = await import('effect');
    const result = await run(Effect.gen(function* () {
      const convoyService = yield* ConvoyService;
      const convoyOpt = yield* convoyService.getConvoy(convoyId);
      if (Option.isNone(convoyOpt)) return null;
      const convoy = convoyOpt.value;
      const progress = yield* convoyService.getProgress(convoy.id);
      return { convoy, progress };
    }));
    
    if (!result) {
      console.log(chalk.red(`Convoy not found: ${convoyId}`));
      return;
    }
    
    const { convoy, progress } = result;
    console.log(chalk.blue(`\nConvoy: ${convoy.id}\n`));
    console.log(`Name: ${convoy.name}`);
    console.log(`Description: ${convoy.description}`);
    console.log(`Status: ${convoy.status}`);
    console.log(`Created: ${convoy.createdAt.toISOString()}`);
    console.log(`\nProgress: ${progress.completed}/${progress.total} tasks completed (${progress.percentComplete}%)`);
    console.log(`  Open: ${progress.open}`);
    console.log(`  In Progress: ${progress.inProgress}`);
    console.log(`  Completed: ${progress.completed}`);
    console.log(`\nTasks: ${convoy.tasks.join(', ')}`);
  });

// OAuth command
program
  .command('oauth')
  .description('Configure OAuth for coding plan')
  .option('--init', 'Initialize OAuth flow')
  .option('--status', 'Check OAuth status')
  .option('--clear', 'Clear stored token')
  .action(async (options) => {
    const workspaceRoot = getWorkspaceRoot();
    const oauthManager = new OAuthManager(workspaceRoot);
    
    if (options.clear) {
      await oauthManager.clearToken();
      console.log(chalk.green('✓ OAuth token cleared'));
      return;
    }
    
    if (options.status) {
      const hasToken = await oauthManager.hasValidToken();
      if (hasToken) {
        console.log(chalk.green('✓ Valid OAuth token found'));
      } else {
        console.log(chalk.yellow('⚠ No valid OAuth token found'));
        console.log(chalk.gray('Run: cs oauth --init'));
      }
      return;
    }
    
    if (options.init) {
      const config = oauthManager.getOAuthConfig();
      await oauthManager.initializeOAuth(config);
      console.log(chalk.green('✓ OAuth initialized'));
      return;
    }
    
    // Default: show status
    const hasToken = await oauthManager.hasValidToken();
    if (hasToken) {
      console.log(chalk.green('✓ OAuth is configured'));
    } else {
      console.log(chalk.yellow('OAuth is not configured'));
      console.log(chalk.gray('Run: cs oauth --init'));
    }
  });

// Provider commands
const providerCmd = program.command('provider').description('Manage AI model providers');

providerCmd
  .command('setup')
  .description('Interactive setup for AI model providers (Z.ai, Claude, OpenAI, MiniMax)')
  .action(async () => {
    const workspaceRoot = getWorkspaceRoot();
    const providerManager = new ProviderManager(workspaceRoot);
    
    try {
      await providerManager.setupProviders();
    } catch (error) {
      console.error(chalk.red('Error during provider setup:'), error);
      process.exit(1);
    }
  });

providerCmd
  .command('list')
  .description('List all configured providers')
  .action(async () => {
    const workspaceRoot = getWorkspaceRoot();
    const providerManager = new ProviderManager(workspaceRoot);
    
    try {
      await providerManager.listProviders();
    } catch (error) {
      console.error(chalk.red('Error listing providers:'), error);
      process.exit(1);
    }
  });

providerCmd
  .command('auth')
  .description('Authenticate configured providers')
  .action(async () => {
    const workspaceRoot = getWorkspaceRoot();
    const providerManager = new ProviderManager(workspaceRoot);
    
    try {
      const providers = await providerManager.loadProviders();
      if (providers.length === 0) {
        console.log(chalk.yellow('No providers configured.'));
        console.log(chalk.gray('Run: cs provider setup'));
        return;
      }
      
      await providerManager.authenticateProviders(providers);
    } catch (error) {
      console.error(chalk.red('Error authenticating providers:'), error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show workspace status')
  .action(async () => {
    try {
      const result = await run(Effect.gen(function* () {
        const config = yield* ConfigService;
        const taskService = yield* TaskService;
        const agentService = yield* AgentService;
        const convoyService = yield* ConvoyService;
        const gitService = yield* GitService;

        const cfg = yield* config.loadConfig();
        const tasks = yield* taskService.listTasks();
        const agents = yield* agentService.listAgents();
        const convoys = yield* convoyService.listConvoys();
        const isClean = yield* gitService.isClean();
        
        return { config: cfg, tasks, agents, convoys, isClean };
      }));

      console.log(chalk.blue(`\nWorkspace: ${result.config.name}\n`));
      console.log(`Path: ${result.config.path}`);
      if (result.config.repository) {
        console.log(`Repository: ${result.config.repository}`);
      }
      
      console.log(chalk.blue('\nStatistics:'));
      console.log(`  Tasks: ${result.tasks.length}`);
      console.log(`    Open: ${result.tasks.filter(t => t.status === 'open').length}`);
      console.log(`    In Progress: ${result.tasks.filter(t => t.status === 'in_progress').length}`);
      console.log(`    Completed: ${result.tasks.filter(t => t.status === 'completed').length}`);
      console.log(`  Agents: ${result.agents.length}`);
      console.log(`    Idle: ${result.agents.filter(a => a.status === 'idle').length}`);
      console.log(`    Working: ${result.agents.filter(a => a.status === 'working').length}`);
      console.log(`  Convoys: ${result.convoys.length}`);
      
      console.log(chalk.blue('\nGit Status:'));
      console.log(`  Working directory: ${result.isClean ? chalk.green('clean') : chalk.yellow('has changes')}`);
    } catch {
      console.log(chalk.red('Error: Workspace not initialized'));
      console.log(chalk.gray('Run: cs init'));
    }
  });

// Tour command
program
  .command('tour')
  .description('Open the CreateSuite tour and landing page')
  .action(async () => {
    const landingPagePath = path.join(__dirname, '..', 'public', 'index.html');
    
    if (!fs.existsSync(landingPagePath)) {
      console.log(chalk.red('Landing page not found.'));
      console.log(chalk.yellow('Please run: npm run video:build'));
      return;
    }
    
    console.log(chalk.blue('Opening CreateSuite tour...'));
    console.log(chalk.gray(`Location: ${landingPagePath}`));
    
    // Open the landing page in the default browser using spawn for safety
    const open = async (filePath: string) => {
      let command: string;
      let args: string[];
      
      if (process.platform === 'darwin') {
        command = 'open';
        args = [filePath];
      } else if (process.platform === 'win32') {
        command = 'cmd';
        args = ['/c', 'start', '""', filePath];
      } else {
        command = 'xdg-open';
        args = [filePath];
      }
      
      return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
          detached: true,
          stdio: 'ignore'
        });
        
        child.on('error', (error) => {
          reject(error);
        });
        
        child.unref();
        resolve();
      });
    };
    
    try {
      await open(landingPagePath);
      console.log(chalk.green('✓ Landing page opened in browser'));
    } catch (error) {
      console.log(chalk.red('Error opening browser:'), (error as Error).message);
    }
  });

// Video command
program
  .command('video')
  .description('Build the CreateSuite tour video')
  .option('--preview', 'Preview the video in Remotion studio')
  .action(async (options) => {
    if (options.preview) {
      console.log(chalk.blue('Opening Remotion preview...'));
      console.log(chalk.gray('This will open the Remotion studio in your browser.'));
      
      exec('npm run remotion:preview', (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.log(chalk.red(`Error: ${error.message}`));
          return;
        }
        if (stderr) {
          console.log(chalk.yellow(stderr));
        }
        console.log(stdout);
      });
    } else {
      console.log(chalk.blue('Building CreateSuite tour video...'));
      console.log(chalk.gray('This may take a few minutes...'));
      
      try {
        const { stdout, stderr } = await execAsync('npm run video:build');
        if (stderr) {
          console.log(chalk.yellow(stderr));
        }
        console.log(stdout);
        console.log(chalk.green('✓ Video built successfully!'));
        console.log(chalk.gray('Location: public/tour.mp4'));
        console.log(chalk.gray('\nRun "cs tour" to view the landing page with the video.'));
      } catch (error: unknown) {
        console.log(chalk.red('Error building video:'));
        if (error instanceof Error) {
          console.log(chalk.red(error.message));
        }
      }
    }
  });

// UI command
program
  .command('ui')
  .description('Start the CreateSuite Agent UI')
  .option('--demo', 'Launch in demo mode with pre-configured agents')
  .action(async (options) => {
    const uiPath = path.join(__dirname, '..', 'agent-ui');
    const serverPath = path.join(uiPath, 'server', 'index.js');
    
    if (!fs.existsSync(serverPath)) {
      console.log(chalk.red('Agent UI server not found.'));
      return;
    }
    
    console.log(chalk.blue('Starting CreateSuite Agent UI...'));
    console.log(chalk.gray(`Server: ${serverPath}`));
    if (options.demo) {
      console.log(chalk.cyan('Demo mode: enabled'));
    }
    console.log(chalk.gray('Building UI...'));
    
    try {
      // Build UI first
      await execAsync('cd agent-ui && npm install && npm run build');
      
      console.log(chalk.green('✓ UI built successfully'));
      console.log(chalk.blue('\n🚀 Server starting on http://localhost:3001'));
      console.log(chalk.gray('Press Ctrl+C to stop'));
      
      // Start server with demo mode environment variable
      const { spawn } = require('child_process');
      const env = {
        ...process.env,
        DEMO_MODE: options.demo ? 'true' : ''
      };
      
      const server = spawn('node', [serverPath], {
        stdio: 'inherit',
        env
      });
      
      server.on('error', (err: Error) => {
        console.error(chalk.red('Failed to start server:'), err);
      });
      
    } catch (error) {
      console.error(chalk.red('Error starting UI:'), (error as Error).message);
    }
  });

// ==================== PIPELINE COMMANDS ====================

// Start command — full end-to-end pipeline
program
  .command('start <repoUrl>')
  .description('Run the full CreateSuite pipeline: clone → plan → agents → PR')
  .option('-g, --goal <goal>', 'The goal for agents to accomplish', 'Improve code quality and add tests')
  .option('-p, --provider <provider>', 'LLM provider (zai-coding-plan, anthropic, openai)', 'zai-coding-plan')
  .option('-m, --model <model>', 'Model to use', 'glm-4.7')
  .option('--max-agents <n>', 'Maximum number of agents', '3')
  .option('--github-token <token>', 'GitHub token for PR creation')
  .option('--dry-run', 'Clone repo and plan tasks but do not execute')
  .action(async (repoUrl, options) => {
    console.log(chalk.blue.bold('\n🚀 CreateSuite Pipeline\n'));
    console.log(chalk.gray(`  Repo:     ${repoUrl}`));
    console.log(chalk.gray(`  Goal:     ${options.goal}`));
    console.log(chalk.gray(`  Provider: ${options.provider}`));
    console.log(chalk.gray(`  Model:    ${options.model}`));
    console.log(chalk.gray(`  Agents:   ${options.maxAgents}`));
    if (options.dryRun) console.log(chalk.yellow('  Mode:     DRY RUN'));
    console.log('');

    try {
      const ghToken = options.githubToken || process.env.GITHUB_TOKEN;
      const status = await run(
        Effect.gen(function* () {
          const pipeline = yield* PipelineService;
          return yield* pipeline.start({
            repoUrl,
            goal: options.goal,
            provider: options.provider,
            model: options.model,
            githubToken: ghToken,
            maxAgents: parseInt(options.maxAgents, 10),
            dryRun: options.dryRun
          });
        }),
        { githubToken: ghToken }
      );

      if (status.prUrl) {
        console.log(chalk.green.bold(`\n✓ Pull request: ${status.prUrl}`));
      }
    } catch (error: any) {
      console.error(chalk.red(`\nPipeline failed: ${error.message}`));
      process.exit(1);
    }
  });

// Repo commands
const repoCmd = program.command('repo').description('Manage target repositories');

repoCmd
  .command('add <url>')
  .description('Clone a GitHub repository for agents to work on')
  .option('--github-token <token>', 'GitHub token for private repos')
  .option('--depth <n>', 'Shallow clone depth')
  .action(async (url, options) => {
    try {
      const ghToken = options.githubToken || process.env.GITHUB_TOKEN;
      const repo = await run(
        Effect.gen(function* () {
          const gitService = yield* GitService;
          return yield* gitService.cloneRepo(url, {
            githubToken: ghToken,
            depth: options.depth ? parseInt(options.depth) : undefined
          });
        }),
        { githubToken: ghToken }
      );
      
      console.log(chalk.green(`✓ Cloned ${repo.owner}/${repo.name}`));
      console.log(chalk.gray(`  Path: ${repo.localPath}`));
      console.log(chalk.gray(`  Branch: ${repo.defaultBranch}`));
    } catch (error: any) {
      console.error(chalk.red(`Failed to clone: ${error.message}`));
      process.exit(1);
    }
  });

repoCmd
  .command('list')
  .description('List cloned repositories')
  .action(async () => {
    try {
      const repos = await run(
        Effect.gen(function* () {
          const gitService = yield* GitService;
          return yield* gitService.listRepos();
        })
      );
      if (repos.length === 0) {
        console.log(chalk.yellow('No repositories cloned'));
        console.log(chalk.gray('Run: cs repo add <github-url>'));
        return;
      }
      
      console.log(chalk.blue(`\nCloned repositories:\n`));
      for (const repo of repos) {
        console.log(`  ${chalk.bold(repo.owner + '/' + repo.name)}`);
        console.log(`    ${chalk.gray(repo.localPath)}`);
        console.log(`    Branch: ${repo.defaultBranch} | Cloned: ${repo.clonedAt.toISOString()}`);
        console.log('');
      }
    } catch (error: any) {
      console.error(chalk.red(`Failed to list repos: ${error.message}`));
      process.exit(1);
    }
  });

// Convoy run command
convoyCmd
  .command('run <convoyId>')
  .description('Execute a convoy — assign tasks to agents and start work')
  .action(async (convoyId) => {
    try {
      const assigned = await run(
        Effect.gen(function* () {
          const convoyService = yield* ConvoyService;
          const agentService = yield* AgentService;
          const taskService = yield* TaskService;
          
          const convoy = yield* convoyService.getConvoy(convoyId);
          if (!convoy._tag) {
            // convoy is Option — check if it exists
          }
          const tasks = yield* taskService.listTasks({});
          const idleAgents = yield* agentService.getIdleAgents();
          
          let assignedCount = 0;
          for (const task of tasks) {
            if (task.status !== 'open') continue;
            const agent = idleAgents[assignedCount];
            if (!agent) break;
            yield* agentService.assignTaskToAgent(agent.id, task.id, getWorkspaceRoot());
            yield* taskService.assignTask(task.id, agent.id);
            assignedCount++;
          }
          return assignedCount;
        })
      );
      console.log(chalk.green(`✓ Convoy ${convoyId} started: ${assigned} task(s) assigned to agents`));
    } catch (error: any) {
      console.error(chalk.red(`Failed to execute convoy: ${error.message}`));
      process.exit(1);
    }
  });

// PR commands
const prCmd = program.command('pr').description('Manage pull requests created by agents');

prCmd
  .command('list')
  .description('List PRs created by CreateSuite agents')
  .option('--repo <owner/name>', 'GitHub repo (owner/name)')
  .option('--state <state>', 'PR state (open|closed|all)', 'open')
  .action(async (options) => {
    const ghToken = process.env.GITHUB_TOKEN;
    try {
      await run(
        Effect.gen(function* () {
          const gitService = yield* GitService;
          const prService = yield* PRService;
          
          let repos: readonly any[];
          if (options.repo) {
            const [owner, name] = options.repo.split('/');
            const repo = yield* gitService.getRepo(owner, name);
            repos = repo ? [repo] : [];
          } else {
            repos = yield* gitService.listRepos();
          }

          if (repos.length === 0) {
            console.log(chalk.yellow('No repositories found'));
            return;
          }

          for (const repo of repos) {
            console.log(chalk.blue(`\n${repo.owner}/${repo.name}:`));
            try {
              const prs = yield* prService.listAgentPRs(repo, options.state);
              if (prs.length === 0) {
                console.log(chalk.gray('  No agent PRs found'));
              } else {
                for (const pr of prs) {
                  const stateColor = pr.state === 'OPEN' ? chalk.green : chalk.gray;
                  console.log(`  ${stateColor(`#${pr.number}`)} ${pr.title}`);
                  console.log(`    ${chalk.gray(pr.url)}`);
                }
              }
            } catch (e: any) {
              console.log(chalk.gray(`  Unable to list PRs: ${e.message}`));
            }
          }
        }),
        { githubToken: ghToken }
      );
    } catch (error: any) {
      console.error(chalk.red(`Failed to list PRs: ${error.message}`));
      process.exit(1);
    }
  });

// Pipeline status command
program
  .command('pipeline')
  .description('Show the current pipeline status')
  .action(async () => {
    try {
      const status = await run(
        Effect.gen(function* () {
          const pipelineService = yield* PipelineService;
          return yield* pipelineService.getStatus();
        })
      );
      if (!status) {
        console.log(chalk.yellow('No pipeline has been run yet'));
        console.log(chalk.gray('Run: cs start <github-url> --goal "your goal"'));
        return;
      }
      
      const phaseColor = 
        status.phase === 'completed' ? chalk.green :
        status.phase === 'failed' ? chalk.red :
        chalk.yellow;
      
      console.log(chalk.blue('\nPipeline Status:\n'));
      console.log(`  ID:    ${status.id}`);
      console.log(`  Repo:  ${status.repoUrl}`);
      console.log(`  Goal:  ${status.goal}`);
      console.log(`  Phase: ${phaseColor(status.phase)}`);
      if (status.convoyId) console.log(`  Convoy: ${status.convoyId}`);
      if (status.prUrl) console.log(`  PR: ${chalk.green(status.prUrl)}`);
      if (status.error) console.log(`  Error: ${chalk.red(status.error)}`);
      console.log(`  Started: ${status.startedAt.toISOString()}`);
      if (status.completedAt) console.log(`  Completed: ${status.completedAt.toISOString()}`);
    } catch (error: any) {
      console.error(chalk.red(`Failed to get pipeline status: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();
