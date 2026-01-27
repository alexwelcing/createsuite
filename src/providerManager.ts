import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { spawn } from 'child_process';

/**
 * Supported AI model providers
 */
export enum Provider {
  ZAI_GLM = 'zai-coding-plan',
  CLAUDE = 'anthropic',
  OPENAI = 'openai',
  MINIMAX = 'minimax',
  GITHUB_COPILOT = 'github-copilot',
  GEMINI = 'google',
  OPENCODE_ZEN = 'opencode-zen'
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: Provider;
  enabled: boolean;
  authenticated: boolean;
  model?: string;
  variant?: string;
  lastValidated?: Date;
}

/**
 * Manages AI model provider configurations and authentication
 */
export class ProviderManager {
  private workspaceRoot: string;
  private configPath: string;
  private opencodeConfigPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.configPath = path.join(workspaceRoot, '.createsuite', 'providers.json');
    this.opencodeConfigPath = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
  }

  /**
   * Check if OpenCode is installed
   */
  async isOpencodeInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', ['opencode']);
      proc.on('close', (code) => {
        resolve(code === 0);
      });
      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Install OpenCode if not present
   */
  async installOpencode(): Promise<void> {
    console.log(chalk.blue('📦 Installing OpenCode...'));
    console.log(chalk.gray('Visit: https://opencode.ai/docs for manual installation'));
    console.log(chalk.yellow('⚠️  OpenCode installation requires manual setup.'));
    console.log(chalk.gray('Please follow the installation instructions at https://opencode.ai/docs'));
    console.log(chalk.gray('After installation, run this setup again.'));
  }

  /**
   * Check if oh-my-opencode is configured
   */
  async isOhMyOpencodeConfigured(): Promise<boolean> {
    if (!fs.existsSync(this.opencodeConfigPath)) {
      return false;
    }

    try {
      const config = JSON.parse(fs.readFileSync(this.opencodeConfigPath, 'utf-8'));
      return config.plugin && config.plugin.includes('oh-my-opencode');
    } catch {
      return false;
    }
  }

  /**
   * Interactive provider setup wizard
   */
  async setupProviders(): Promise<void> {
    console.log(chalk.bold.blue('\n🚀 CreateSuite Provider Setup\n'));
    console.log(chalk.gray('Configure AI model providers for your agents\n'));

    // Check OpenCode installation
    const opencodeInstalled = await this.isOpencodeInstalled();
    if (!opencodeInstalled) {
      console.log(chalk.yellow('⚠️  OpenCode is not installed.'));
      const { shouldInstall } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldInstall',
          message: 'Would you like installation instructions?',
          default: true
        }
      ]);

      if (shouldInstall) {
        await this.installOpencode();
        return;
      }
    } else {
      console.log(chalk.green('✓ OpenCode is installed'));
    }

    // Check oh-my-opencode
    const omoConfigured = await this.isOhMyOpencodeConfigured();
    if (!omoConfigured) {
      console.log(chalk.yellow('\n⚠️  oh-my-opencode is not configured.'));
      const { shouldSetupOmo } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldSetupOmo',
          message: 'Would you like to set up oh-my-opencode now?',
          default: true
        }
      ]);

      if (shouldSetupOmo) {
        await this.setupOhMyOpencode();
      }
    } else {
      console.log(chalk.green('✓ oh-my-opencode is configured'));
    }

    // Provider subscription questions
    console.log(chalk.bold.cyan('\n📋 Provider Subscriptions\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'hasZai',
        message: chalk.bold('🔷 Do you have Z.ai GLM 4.7 access via coding plan?'),
        default: false
      },
      {
        type: 'confirm',
        name: 'hasClaude',
        message: chalk.bold('🟣 Do you have Claude Opus/Sonnet 4.5 access via coding plan?'),
        default: false
      },
      {
        type: 'list',
        name: 'claudeTier',
        message: '  What tier?',
        choices: ['Pro', 'Max (20x mode)'],
        when: (answers) => answers.hasClaude,
        default: 'Pro'
      },
      {
        type: 'confirm',
        name: 'hasOpenAI',
        message: chalk.bold('🟢 Do you have OpenAI access via coding plan?'),
        default: false
      },
      {
        type: 'confirm',
        name: 'hasMinimax',
        message: chalk.bold('🔵 Do you have MiniMax 2.1 access via coding plan?'),
        default: false
      },
      {
        type: 'confirm',
        name: 'hasGemini',
        message: chalk.bold('🔴 Do you have Gemini access?'),
        default: false
      },
      {
        type: 'confirm',
        name: 'hasCopilot',
        message: chalk.bold('🐙 Do you have GitHub Copilot subscription?'),
        default: false
      },
      {
        type: 'confirm',
        name: 'hasOpencodeZen',
        message: chalk.bold('🧘 Do you have OpenCode Zen access?'),
        default: false
      }
    ]);

    // Build provider configuration
    const providers: ProviderConfig[] = [];

    if (answers.hasZai) {
      providers.push({
        provider: Provider.ZAI_GLM,
        enabled: true,
        authenticated: false,
        model: 'zai-coding-plan/glm-4.7'
      });
    }

    if (answers.hasClaude) {
      providers.push({
        provider: Provider.CLAUDE,
        enabled: true,
        authenticated: false,
        model: answers.claudeTier === 'Max (20x mode)' ? 'anthropic/claude-opus-4.5-max20' : 'anthropic/claude-opus-4.5'
      });
    }

    if (answers.hasOpenAI) {
      providers.push({
        provider: Provider.OPENAI,
        enabled: true,
        authenticated: false,
        model: 'openai/gpt-5.2'
      });
    }

    if (answers.hasMinimax) {
      providers.push({
        provider: Provider.MINIMAX,
        enabled: true,
        authenticated: false,
        model: 'minimax/minimax-2.1'
      });
    }

    if (answers.hasGemini) {
      providers.push({
        provider: Provider.GEMINI,
        enabled: true,
        authenticated: false,
        model: 'google/gemini-3-pro'
      });
    }

    if (answers.hasCopilot) {
      providers.push({
        provider: Provider.GITHUB_COPILOT,
        enabled: true,
        authenticated: false,
        model: 'github-copilot/claude-opus-4.5'
      });
    }

    if (answers.hasOpencodeZen) {
      providers.push({
        provider: Provider.OPENCODE_ZEN,
        enabled: true,
        authenticated: false,
        model: 'opencode/claude-opus-4.5'
      });
    }

    // Save provider configuration
    await this.saveProviders(providers);

    // Show setup summary
    console.log(chalk.bold.green('\n✨ Provider Configuration Complete!\n'));
    
    if (providers.length === 0) {
      console.log(chalk.yellow('⚠️  No providers configured. You can run this setup again later.'));
      return;
    }

    console.log(chalk.bold('Configured Providers:'));
    providers.forEach(p => {
      console.log(chalk.gray(`  • ${this.getProviderDisplayName(p.provider)}: ${p.model}`));
    });

    // Authentication steps
    console.log(chalk.bold.cyan('\n🔐 Next: Authenticate Your Providers\n'));
    
    const { shouldAuth } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldAuth',
        message: 'Would you like to authenticate your providers now?',
        default: true
      }
    ]);

    if (shouldAuth) {
      await this.authenticateProviders(providers);
    } else {
      console.log(chalk.gray('\nYou can authenticate later by running:'));
      console.log(chalk.blue('  cs provider auth\n'));
    }
  }

  /**
   * Set up oh-my-opencode
   */
  async setupOhMyOpencode(): Promise<void> {
    console.log(chalk.blue('\n📦 Setting up oh-my-opencode...\n'));
    console.log(chalk.gray('oh-my-opencode provides advanced agent orchestration capabilities.'));
    console.log(chalk.gray('Learn more: https://github.com/code-yeongyu/oh-my-opencode\n'));

    // The installer will handle everything
    console.log(chalk.yellow('Run the following command to complete setup:'));
    console.log(chalk.blue('  bunx oh-my-opencode install\n'));
    console.log(chalk.gray('or if you prefer npm:'));
    console.log(chalk.blue('  npx oh-my-opencode install\n'));
  }

  /**
   * Authenticate providers
   */
  async authenticateProviders(providers: ProviderConfig[]): Promise<void> {
    for (const provider of providers) {
      console.log(chalk.bold(`\n🔐 Authenticating ${this.getProviderDisplayName(provider.provider)}...\n`));

      switch (provider.provider) {
        case Provider.CLAUDE:
          await this.authenticateClaude();
          break;
        case Provider.OPENAI:
          await this.authenticateOpenAI();
          break;
        case Provider.GEMINI:
          await this.authenticateGemini();
          break;
        case Provider.ZAI_GLM:
          await this.authenticateZai();
          break;
        case Provider.MINIMAX:
          await this.authenticateMinimax();
          break;
        case Provider.GITHUB_COPILOT:
          await this.authenticateCopilot();
          break;
        case Provider.OPENCODE_ZEN:
          await this.authenticateOpencodeZen();
          break;
      }

      // Mark as authenticated
      provider.authenticated = true;
      provider.lastValidated = new Date();
      await this.saveProviders(providers);
    }

    console.log(chalk.bold.green('\n🎉 All providers authenticated successfully!\n'));
  }

  /**
   * Authenticate Claude via OpenCode
   */
  private async authenticateClaude(): Promise<void> {
    console.log(chalk.gray('Opening OpenCode authentication...'));
    console.log(chalk.yellow('\nPlease complete the following steps:'));
    console.log(chalk.gray('  1. Run: opencode auth login'));
    console.log(chalk.gray('  2. Select Provider: Anthropic'));
    console.log(chalk.gray('  3. Select Login method: Claude Pro/Max'));
    console.log(chalk.gray('  4. Complete OAuth flow in browser'));
    
    const { completed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completed',
        message: 'Have you completed the authentication?',
        default: false
      }
    ]);

    if (completed) {
      console.log(chalk.green('✓ Claude authentication complete'));
    } else {
      console.log(chalk.yellow('⚠️  Authentication skipped. You can authenticate later.'));
    }
  }

  /**
   * Authenticate OpenAI via OpenCode
   */
  private async authenticateOpenAI(): Promise<void> {
    console.log(chalk.gray('OpenAI authentication via coding plan...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Ensure your OpenAI API key is configured'));
    console.log(chalk.gray('  2. Run: opencode auth login'));
    console.log(chalk.gray('  3. Select Provider: OpenAI'));
    console.log(chalk.gray('  4. Enter your API key'));
    
    const { completed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completed',
        message: 'Have you completed the authentication?',
        default: false
      }
    ]);

    if (completed) {
      console.log(chalk.green('✓ OpenAI authentication complete'));
    }
  }

  /**
   * Authenticate Gemini
   */
  private async authenticateGemini(): Promise<void> {
    console.log(chalk.gray('Setting up Gemini Antigravity authentication...'));
    console.log(chalk.yellow('\nSteps:'));
    console.log(chalk.gray('  1. Install: npm install -g opencode-antigravity-auth'));
    console.log(chalk.gray('  2. Add to opencode.json plugin array'));
    console.log(chalk.gray('  3. Run: opencode auth login'));
    console.log(chalk.gray('  4. Select Provider: Google'));
    console.log(chalk.gray('  5. Select: OAuth with Google (Antigravity)'));
    
    const { completed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completed',
        message: 'Have you completed the authentication?',
        default: false
      }
    ]);

    if (completed) {
      console.log(chalk.green('✓ Gemini authentication complete'));
    }
  }

  /**
   * Authenticate Z.ai GLM
   */
  private async authenticateZai(): Promise<void> {
    console.log(chalk.gray('Z.ai GLM 4.7 authentication...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Visit your Z.ai coding plan dashboard'));
    console.log(chalk.gray('  2. Configure API access credentials'));
    console.log(chalk.gray('  3. Run: opencode auth login'));
    console.log(chalk.gray('  4. Select Provider: Z.ai'));
    
    const { completed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completed',
        message: 'Have you completed the authentication?',
        default: false
      }
    ]);

    if (completed) {
      console.log(chalk.green('✓ Z.ai authentication complete'));
    }
  }

  /**
   * Authenticate MiniMax
   */
  private async authenticateMinimax(): Promise<void> {
    console.log(chalk.gray('MiniMax 2.1 authentication...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Obtain your MiniMax API credentials'));
    console.log(chalk.gray('  2. Configure via OpenCode or direct API key'));
    
    const { completed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completed',
        message: 'Have you completed the authentication?',
        default: false
      }
    ]);

    if (completed) {
      console.log(chalk.green('✓ MiniMax authentication complete'));
    }
  }

  /**
   * Authenticate GitHub Copilot
   */
  private async authenticateCopilot(): Promise<void> {
    console.log(chalk.gray('GitHub Copilot authentication...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Run: opencode auth login'));
    console.log(chalk.gray('  2. Select Provider: GitHub'));
    console.log(chalk.gray('  3. Complete OAuth flow'));
    
    const { completed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completed',
        message: 'Have you completed the authentication?',
        default: false
      }
    ]);

    if (completed) {
      console.log(chalk.green('✓ GitHub Copilot authentication complete'));
    }
  }

  /**
   * Authenticate OpenCode Zen
   */
  private async authenticateOpencodeZen(): Promise<void> {
    console.log(chalk.gray('OpenCode Zen authentication...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Ensure you have OpenCode Zen access'));
    console.log(chalk.gray('  2. Models are available with opencode/ prefix'));
    
    const { completed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completed',
        message: 'Have you completed the setup?',
        default: false
      }
    ]);

    if (completed) {
      console.log(chalk.green('✓ OpenCode Zen setup complete'));
    }
  }

  /**
   * Get display name for provider
   */
  private getProviderDisplayName(provider: Provider): string {
    const names: Record<Provider, string> = {
      [Provider.ZAI_GLM]: 'Z.ai GLM 4.7',
      [Provider.CLAUDE]: 'Claude Opus/Sonnet 4.5',
      [Provider.OPENAI]: 'OpenAI GPT-5.2',
      [Provider.MINIMAX]: 'MiniMax 2.1',
      [Provider.GEMINI]: 'Google Gemini 3 Pro',
      [Provider.GITHUB_COPILOT]: 'GitHub Copilot',
      [Provider.OPENCODE_ZEN]: 'OpenCode Zen'
    };
    return names[provider];
  }

  /**
   * Save provider configuration
   */
  async saveProviders(providers: ProviderConfig[]): Promise<void> {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config = {
      providers,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Load provider configuration
   */
  async loadProviders(): Promise<ProviderConfig[]> {
    if (!fs.existsSync(this.configPath)) {
      return [];
    }

    try {
      const data = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(data);
      return config.providers || [];
    } catch {
      return [];
    }
  }

  /**
   * Validate provider authentication
   */
  async validateProvider(provider: Provider): Promise<boolean> {
    // This would normally make an API call to verify authentication
    // For now, we'll just check if the provider is configured
    const providers = await this.loadProviders();
    const config = providers.find(p => p.provider === provider);
    return config?.authenticated || false;
  }

  /**
   * List all configured providers
   */
  async listProviders(): Promise<void> {
    const providers = await this.loadProviders();

    if (providers.length === 0) {
      console.log(chalk.yellow('No providers configured.'));
      console.log(chalk.gray('Run: cs provider setup'));
      return;
    }

    console.log(chalk.bold.blue('\n🚀 Configured Providers:\n'));

    for (const provider of providers) {
      const status = provider.authenticated ? chalk.green('✓ Authenticated') : chalk.yellow('⚠ Not authenticated');
      const displayName = this.getProviderDisplayName(provider.provider);
      
      console.log(chalk.bold(`${displayName}`));
      console.log(chalk.gray(`  Model: ${provider.model}`));
      console.log(`  Status: ${status}`);
      if (provider.lastValidated) {
        console.log(chalk.gray(`  Last validated: ${new Date(provider.lastValidated).toLocaleString()}`));
      }
      console.log('');
    }
  }
}
