#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from './config';
import { TaskManager } from './taskManager';
import { AgentOrchestrator } from './agentOrchestrator';
import { ConvoyManager } from './convoyManager';
import { GitIntegration } from './gitIntegration';
import { OAuthManager } from './oauthManager';
import { ProviderManager } from './providerManager';
import { TaskStatus, TaskPriority, ConvoyStatus, AgentStatus, AgentRuntime, Task } from './types';
import { SmartRouter, WorkflowType } from './smartRouter';

const execAsync = promisify(exec);
const VALID_AGENT_RUNTIMES = ['local', 'fly'];

const program = new Command();

// Get workspace root (current directory by default)
const getWorkspaceRoot = (): string => {
  return process.cwd();
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
    
    const configManager = new ConfigManager(workspaceRoot);
    await configManager.initialize(name, options.repo);
    
    if (options.git) {
      const gitIntegration = new GitIntegration(workspaceRoot);
      await gitIntegration.initialize();
      console.log(chalk.green('✓ Git repository initialized'));
    }
    
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
    const workspaceRoot = getWorkspaceRoot();
    const taskManager = new TaskManager(workspaceRoot);
    const gitIntegration = new GitIntegration(workspaceRoot);
    const smartRouter = new SmartRouter();
    
    const title = options.title || 'New Task';
    const description = options.description || '';
    const priority = options.priority as TaskPriority;
    const tags = options.tags ? options.tags.split(',') : [];
    
    const fullDescription = `${title} ${description}`.trim();
    const routingResult = smartRouter.route(fullDescription);
    
    const task = await taskManager.createTask(title, description, priority, tags);
    
    await gitIntegration.commitTaskChanges(`Created task: ${task.id} - ${task.title}`);
    
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
    const workspaceRoot = getWorkspaceRoot();
    const taskManager = new TaskManager(workspaceRoot);
    
    const filters: {
      status?: TaskStatus;
      assignedAgent?: string;
      priority?: TaskPriority;
    } = {};
    if (options.status) filters.status = options.status;
    if (options.agent) filters.assignedAgent = options.agent;
    
    const tasks = await taskManager.listTasks(filters);
    
    if (tasks.length === 0) {
      console.log(chalk.yellow('No tasks found'));
      return;
    }
    
    console.log(chalk.blue(`\nFound ${tasks.length} task(s):\n`));
    for (const task of tasks) {
      const statusColor = 
        task.status === TaskStatus.COMPLETED ? chalk.green :
        task.status === TaskStatus.IN_PROGRESS ? chalk.yellow :
        task.status === TaskStatus.BLOCKED ? chalk.red :
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
    const workspaceRoot = getWorkspaceRoot();
    const taskManager = new TaskManager(workspaceRoot);
    
    const task = await taskManager.getTask(taskId);
    if (!task) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      return;
    }
    
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
    const workspaceRoot = getWorkspaceRoot();
    const orchestrator = new AgentOrchestrator(workspaceRoot);
    const gitIntegration = new GitIntegration(workspaceRoot);
    
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
      runtime = AgentRuntime.FLY;
    } else if (runtimeInput === 'local') {
      runtime = AgentRuntime.LOCAL;
    }
    
    const agent = await orchestrator.createAgent(name, capabilities, {
      runtime,
      flyAppName: options.flyApp
    });
    await gitIntegration.commitTaskChanges(`Created agent: ${agent.name} (${agent.id})`);
    
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
    const workspaceRoot = getWorkspaceRoot();
    const orchestrator = new AgentOrchestrator(workspaceRoot);
    
    const agents = await orchestrator.listAgents();
    
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents found'));
      return;
    }
    
    console.log(chalk.blue(`\nFound ${agents.length} agent(s):\n`));
    for (const agent of agents) {
      const statusColor = 
        agent.status === AgentStatus.WORKING ? chalk.green :
        agent.status === AgentStatus.IDLE ? chalk.yellow :
        agent.status === AgentStatus.ERROR ? chalk.red :
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
    const workspaceRoot = getWorkspaceRoot();
    const orchestrator = new AgentOrchestrator(workspaceRoot);
    const taskManager = new TaskManager(workspaceRoot);
    const gitIntegration = new GitIntegration(workspaceRoot);
    
    await orchestrator.assignTaskToAgent(agentId, taskId);
    await taskManager.assignTask(taskId, agentId);
    await gitIntegration.commitTaskChanges(`Assigned task ${taskId} to agent ${agentId}`);
    
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
    const workspaceRoot = getWorkspaceRoot();
    const convoyManager = new ConvoyManager(workspaceRoot);
    const gitIntegration = new GitIntegration(workspaceRoot);
    
    const description = options.description || '';
    const taskIds = options.tasks ? options.tasks.split(',') : [];
    
    const convoy = await convoyManager.createConvoy(name, description, taskIds);
    await gitIntegration.commitTaskChanges(`Created convoy: ${convoy.id} - ${convoy.name}`);
    
    console.log(chalk.green(`✓ Convoy created: ${convoy.id}`));
    console.log(chalk.gray(`  Name: ${convoy.name}`));
    console.log(chalk.gray(`  Tasks: ${convoy.tasks.length}`));
  });

convoyCmd
  .command('list')
  .description('List all convoys')
  .option('-s, --status <status>', 'Filter by status')
  .action(async (options) => {
    const workspaceRoot = getWorkspaceRoot();
    const convoyManager = new ConvoyManager(workspaceRoot);
    
    const status = options.status as ConvoyStatus | undefined;
    const convoys = await convoyManager.listConvoys(status);
    
    if (convoys.length === 0) {
      console.log(chalk.yellow('No convoys found'));
      return;
    }
    
    console.log(chalk.blue(`\nFound ${convoys.length} convoy(s):\n`));
    for (const convoy of convoys) {
      const progress = await convoyManager.getConvoyProgress(convoy.id);
      
      console.log(`${chalk.bold(convoy.id)} - ${convoy.name}`);
      console.log(`  Status: ${convoy.status}`);
      console.log(`  Tasks: ${convoy.tasks.length}`);
      console.log(`  Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
      console.log('');
    }
  });

convoyCmd
  .command('show <convoyId>')
  .description('Show convoy details')
  .action(async (convoyId) => {
    const workspaceRoot = getWorkspaceRoot();
    const convoyManager = new ConvoyManager(workspaceRoot);
    
    const convoy = await convoyManager.getConvoy(convoyId);
    if (!convoy) {
      console.log(chalk.red(`Convoy not found: ${convoyId}`));
      return;
    }
    
    const progress = await convoyManager.getConvoyProgress(convoy.id);
    
    console.log(chalk.blue(`\nConvoy: ${convoy.id}\n`));
    console.log(`Name: ${convoy.name}`);
    console.log(`Description: ${convoy.description}`);
    console.log(`Status: ${convoy.status}`);
    console.log(`Created: ${convoy.createdAt.toISOString()}`);
    console.log(`\nProgress: ${progress.completed}/${progress.total} tasks completed (${progress.percentage}%)`);
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
    const workspaceRoot = getWorkspaceRoot();
    const configManager = new ConfigManager(workspaceRoot);
    const taskManager = new TaskManager(workspaceRoot);
    const orchestrator = new AgentOrchestrator(workspaceRoot);
    const convoyManager = new ConvoyManager(workspaceRoot);
    const gitIntegration = new GitIntegration(workspaceRoot);
    
    try {
      const config = await configManager.loadConfig();
      const tasks = await taskManager.listTasks();
      const agents = await orchestrator.listAgents();
      const convoys = await convoyManager.listConvoys();
      
      console.log(chalk.blue(`\nWorkspace: ${config.name}\n`));
      console.log(`Path: ${config.path}`);
      if (config.repository) {
        console.log(`Repository: ${config.repository}`);
      }
      
      console.log(chalk.blue('\nStatistics:'));
      console.log(`  Tasks: ${tasks.length}`);
      console.log(`    Open: ${tasks.filter(t => t.status === TaskStatus.OPEN).length}`);
      console.log(`    In Progress: ${tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length}`);
      console.log(`    Completed: ${tasks.filter(t => t.status === TaskStatus.COMPLETED).length}`);
      console.log(`  Agents: ${agents.length}`);
      console.log(`    Idle: ${agents.filter(a => a.status === AgentStatus.IDLE).length}`);
      console.log(`    Working: ${agents.filter(a => a.status === AgentStatus.WORKING).length}`);
      console.log(`  Convoys: ${convoys.length}`);
      
      // Git status
      const isClean = await gitIntegration.isClean();
      console.log(chalk.blue('\nGit Status:'));
      console.log(`  Working directory: ${isClean ? chalk.green('clean') : chalk.yellow('has changes')}`);
      
    } catch (error) {
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

program.parse();
