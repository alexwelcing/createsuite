import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { LocalhostOAuth } from './localhostOAuth';

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
  OPENCODE_ZEN = 'opencode-zen',
  HUGGINGFACE = 'huggingface'
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
  private credentialsPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.configPath = path.join(workspaceRoot, '.createsuite', 'providers.json');
    this.opencodeConfigPath = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
    this.credentialsPath = path.join(workspaceRoot, '.createsuite', 'provider-credentials.json');
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

    // Provider selection
    console.log(chalk.bold.cyan('\n📋 Choose Your Providers\n'));

    const providerChoices = [
      { name: '� Claude Sonnet 4 (Anthropic)', value: Provider.CLAUDE },
      { name: '🟢 OpenAI GPT-4o', value: Provider.OPENAI },
      { name: '🔴 Google Gemini 2.0 Flash', value: Provider.GEMINI },
      { name: '🐙 GitHub Copilot', value: Provider.GITHUB_COPILOT },
      { name: '🧘 OpenCode Zen', value: Provider.OPENCODE_ZEN },
      { name: '🤗 Hugging Face Inference (assets)', value: Provider.HUGGINGFACE },
      { name: '🔷 Z.ai (via Anthropic)', value: Provider.ZAI_GLM },
      { name: '🔵 MiniMax', value: Provider.MINIMAX }
    ];

    const { selectedProviders } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedProviders',
        message: 'Select all providers you want to enable:',
        choices: providerChoices,
        pageSize: providerChoices.length
      }
    ]);

    const providers: ProviderConfig[] = [];

    const shouldInclude = (provider: Provider) => selectedProviders.includes(provider);

    let claudeModel = 'anthropic/claude-sonnet-4-20250514';
    if (shouldInclude(Provider.CLAUDE)) {
      const { claudeTier } = await inquirer.prompt([
        {
          type: 'list',
          name: 'claudeTier',
          message: 'Claude tier:',
          choices: ['Pro', 'Max (20x mode)'],
          default: 'Pro'
        }
      ]);
      claudeModel = claudeTier === 'Max (20x mode)'
        ? 'anthropic/claude-sonnet-4-20250514'
        : 'anthropic/claude-sonnet-4-20250514';
    }

    if (shouldInclude(Provider.ZAI_GLM)) {
      providers.push({
        provider: Provider.ZAI_GLM,
        enabled: true,
        authenticated: false,
        model: 'anthropic/claude-sonnet-4-20250514'
      });
    }

    if (shouldInclude(Provider.CLAUDE)) {
      providers.push({
        provider: Provider.CLAUDE,
        enabled: true,
        authenticated: false,
        model: claudeModel
      });
    }

    if (shouldInclude(Provider.OPENAI)) {
      providers.push({
        provider: Provider.OPENAI,
        enabled: true,
        authenticated: false,
        model: 'openai/gpt-4o'
      });
    }

    if (shouldInclude(Provider.MINIMAX)) {
      providers.push({
        provider: Provider.MINIMAX,
        enabled: true,
        authenticated: false,
        model: 'minimax/minimax-01'
      });
    }

    if (shouldInclude(Provider.GEMINI)) {
      providers.push({
        provider: Provider.GEMINI,
        enabled: true,
        authenticated: false,
        model: 'google/gemini-2.0-flash'
      });
    }

    if (shouldInclude(Provider.GITHUB_COPILOT)) {
      providers.push({
        provider: Provider.GITHUB_COPILOT,
        enabled: true,
        authenticated: false,
        model: 'github-copilot/claude-sonnet-4-20250514'
      });
    }

    if (shouldInclude(Provider.OPENCODE_ZEN)) {
      providers.push({
        provider: Provider.OPENCODE_ZEN,
        enabled: true,
        authenticated: false,
        model: 'opencode/claude-sonnet-4-20250514'
      });
    }

    if (shouldInclude(Provider.HUGGINGFACE)) {
      providers.push({
        provider: Provider.HUGGINGFACE,
        enabled: true,
        authenticated: false,
        model: 'huggingface/stable-diffusion-xl-base-1.0'
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
    let authenticatedCount = 0;

    for (let index = 0; index < providers.length; index += 1) {
      const provider = providers[index];
      console.log(chalk.bold(`\n🔐 (${index + 1}/${providers.length}) Authenticating ${this.getProviderDisplayName(provider.provider)}...\n`));

      let authenticated = false;

      switch (provider.provider) {
        case Provider.CLAUDE:
          authenticated = await this.authenticateClaude();
          break;
        case Provider.OPENAI:
          authenticated = await this.authenticateOpenAI();
          break;
        case Provider.GEMINI:
          authenticated = await this.authenticateGemini();
          break;
        case Provider.ZAI_GLM:
          authenticated = await this.authenticateZai();
          break;
        case Provider.MINIMAX:
          authenticated = await this.authenticateMinimax();
          break;
        case Provider.GITHUB_COPILOT:
          authenticated = await this.authenticateCopilot();
          break;
        case Provider.OPENCODE_ZEN:
          authenticated = await this.authenticateOpencodeZen();
          break;
        case Provider.HUGGINGFACE:
          authenticated = await this.authenticateHuggingFace();
          break;
      }

      provider.authenticated = authenticated;
      provider.lastValidated = authenticated ? new Date() : provider.lastValidated;
      if (authenticated) {
        authenticatedCount += 1;
      }
      await this.saveProviders(providers);
    }

    if (authenticatedCount === providers.length) {
      console.log(chalk.bold.green('\n🎉 All providers authenticated successfully!\n'));
    } else {
      console.log(chalk.yellow(`\n⚠️  ${authenticatedCount}/${providers.length} providers authenticated.`));
      console.log(chalk.gray('You can re-run authentication anytime with:'));
      console.log(chalk.blue('  cs provider auth\n'));
    }
  }

  /**
   * Authenticate Claude via OpenCode
   */
  private async authenticateClaude(): Promise<boolean> {
    console.log(chalk.gray('Opening OpenCode authentication...'));
    console.log(chalk.yellow('\nPlease complete the following steps:'));
    console.log(chalk.gray('  1. Run: opencode auth login'));
    console.log(chalk.gray('  2. Select Provider: Anthropic'));
    console.log(chalk.gray('  3. Select Login method: Claude Pro/Max'));
    console.log(chalk.gray('  4. Complete OAuth flow in browser'));

    await this.runOpencodeAuth('Anthropic');
    
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
    }
    return completed;
  }

  /**
   * Authenticate OpenAI via localhost OAuth or API key
   */
  private async authenticateOpenAI(): Promise<boolean> {
    console.log(chalk.bold.blue('\n🟢 OpenAI Authentication\n'));
    
    const { method } = await inquirer.prompt([
      {
        type: 'list',
        name: 'method',
        message: 'Choose authentication method:',
        choices: [
          { name: '🔑 API Key (Recommended)', value: 'api-key' },
          { name: '🌐 OAuth Flow (Browser)', value: 'oauth' }
        ],
        default: 'api-key'
      }
    ]);

    if (method === 'api-key') {
      return await this.authenticateOpenAIWithAPIKey();
    }
    return await this.authenticateOpenAIWithOAuth();
  }

  /**
   * Authenticate OpenAI with API key
   */
  private async authenticateOpenAIWithAPIKey(): Promise<boolean> {
    console.log(chalk.gray('\n📝 Enter your OpenAI API key'));
    console.log(chalk.gray('Get your API key from: https://platform.openai.com/api-keys\n'));

    const { apiKey, confirm } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'OpenAI API Key:',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'API key is required';
          }
          if (!input.startsWith('sk-')) {
            return 'OpenAI API keys typically start with "sk-"';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Save this API key securely?',
        default: true
      }
    ]);

    if (confirm) {
      // Store API key securely
      const credPath = path.join(this.workspaceRoot, '.createsuite', 'openai-credentials.json');
      const credDir = path.dirname(credPath);
      
      if (!fs.existsSync(credDir)) {
        fs.mkdirSync(credDir, { recursive: true });
      }

      fs.writeFileSync(
        credPath,
        JSON.stringify({ apiKey: apiKey.trim(), createdAt: new Date().toISOString() }, null, 2),
        { mode: 0o600 } // Restrict permissions
      );

      console.log(chalk.green('\n✓ OpenAI API key saved securely'));
      console.log(chalk.gray(`Stored in: ${credPath}`));
      console.log(chalk.yellow('\n⚠️  Keep your API key secure and never commit it to git'));
    }
    return confirm;
  }

  /**
   * Authenticate OpenAI with OAuth
   */
  private async authenticateOpenAIWithOAuth(): Promise<boolean> {
    console.log(chalk.gray('\n🌐 Starting OAuth flow...'));
    console.log(chalk.gray('A browser window will open for authentication\n'));

    try {
      const oauth = new LocalhostOAuth(3000);
      
      // Note: OpenAI doesn't have a standard OAuth flow for API access
      // This is a demonstration - in practice, most users will use API keys
      console.log(chalk.yellow('⚠️  OpenAI primarily uses API keys for authentication'));
      console.log(chalk.gray('OAuth flow is not officially supported by OpenAI'));
      console.log(chalk.gray('Falling back to API key method...\n'));
      
      return await this.authenticateOpenAIWithAPIKey();
    } catch (error) {
      console.error(chalk.red('OAuth flow failed:'), error);
      console.log(chalk.yellow('\nFalling back to API key method...'));
      return await this.authenticateOpenAIWithAPIKey();
    }
  }

  /**
   * Authenticate Gemini
   */
  private async authenticateGemini(): Promise<boolean> {
    console.log(chalk.gray('Setting up Gemini Antigravity authentication...'));
    console.log(chalk.yellow('\nSteps:'));
    console.log(chalk.gray('  1. Install: npm install -g opencode-antigravity-auth'));
    console.log(chalk.gray('  2. Add to opencode.json plugin array'));
    console.log(chalk.gray('  3. Run: opencode auth login'));
    console.log(chalk.gray('  4. Select Provider: Google'));
    console.log(chalk.gray('  5. Select: OAuth with Google (Antigravity)'));

    await this.runOpencodeAuth('Google');
    
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
    return completed;
  }

  /**
   * Authenticate Z.ai GLM
   */
  private async authenticateZai(): Promise<boolean> {
    console.log(chalk.gray('Z.ai GLM 4.7 authentication...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Visit your Z.ai coding plan dashboard'));
    console.log(chalk.gray('  2. Configure API access credentials'));
    console.log(chalk.gray('  3. Run: opencode auth login'));
    console.log(chalk.gray('  4. Select Provider: Z.ai'));

    const stored = await this.promptForApiKey(Provider.ZAI_GLM, 'Z.ai API key');
    if (stored) {
      console.log(chalk.green('✓ Z.ai API key saved securely'));
    }

    await this.runOpencodeAuth('Z.ai');
    
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
    return completed || stored;
  }

  /**
   * Authenticate MiniMax
   */
  private async authenticateMinimax(): Promise<boolean> {
    console.log(chalk.gray('MiniMax 2.1 authentication...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Obtain your MiniMax API credentials'));
    console.log(chalk.gray('  2. Configure via OpenCode or direct API key'));

    const stored = await this.promptForApiKey(Provider.MINIMAX, 'MiniMax API key');
    if (stored) {
      console.log(chalk.green('✓ MiniMax API key saved securely'));
    }
    
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
    return completed || stored;
  }

  /**
   * Authenticate GitHub Copilot
   */
  private async authenticateCopilot(): Promise<boolean> {
    console.log(chalk.gray('GitHub Copilot authentication...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Run: opencode auth login'));
    console.log(chalk.gray('  2. Select Provider: GitHub'));
    console.log(chalk.gray('  3. Complete OAuth flow'));

    await this.runOpencodeAuth('GitHub');
    
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
    return completed;
  }

  /**
   * Authenticate OpenCode Zen
   */
  private async authenticateOpencodeZen(): Promise<boolean> {
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
    return completed;
  }

  /**
   * Authenticate Hugging Face
   */
  private async authenticateHuggingFace(): Promise<boolean> {
    console.log(chalk.gray('Hugging Face Inference authentication...'));
    console.log(chalk.yellow('\nAuthentication steps:'));
    console.log(chalk.gray('  1. Obtain your Hugging Face API token'));
    console.log(chalk.gray('  2. Run: opencode auth login'));
    console.log(chalk.gray('  3. Select Provider: Hugging Face'));

    const stored = await this.promptForApiKey(Provider.HUGGINGFACE, 'Hugging Face API token');
    if (stored) {
      console.log(chalk.green('✓ Hugging Face token saved securely'));
    }

    await this.runOpencodeAuth('Hugging Face');
    
    const { completed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completed',
        message: 'Have you completed the authentication?',
        default: false
      }
    ]);

    if (completed) {
      console.log(chalk.green('✓ Hugging Face authentication complete'));
    }
    return completed || stored;
  }

  private async runOpencodeAuth(providerLabel: string): Promise<void> {
    const opencodeInstalled = await this.isOpencodeInstalled();
    if (!opencodeInstalled) {
      console.log(chalk.yellow('⚠️  OpenCode is not installed. Install it first: https://opencode.ai/docs'));
      return;
    }

    const { runNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runNow',
        message: `Run "opencode auth login" now for ${providerLabel}?`,
        default: true
      }
    ]);

    if (!runNow) {
      return;
    }

    await new Promise<void>((resolve) => {
      const proc = spawn('opencode', ['auth', 'login'], { stdio: 'inherit' });
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });
  }

  private async promptForApiKey(provider: Provider, label: string): Promise<boolean> {
    const { wantsKey } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'wantsKey',
        message: `Do you want to save a ${label} now?`,
        default: false
      }
    ]);

    if (!wantsKey) {
      return false;
    }

    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `${label}:`,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Value is required';
          }
          return true;
        }
      }
    ]);

    this.storeProviderCredential(provider, apiKey.trim());
    return true;
  }

  private storeProviderCredential(provider: Provider, value: string): void {
    const dir = path.dirname(this.credentialsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let existing: Record<string, { value: string; updatedAt: string }> = {};
    if (fs.existsSync(this.credentialsPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf-8'));
      } catch {
        existing = {};
      }
    }

    existing[provider] = { value, updatedAt: new Date().toISOString() };
    fs.writeFileSync(this.credentialsPath, JSON.stringify(existing, null, 2), { mode: 0o600 });
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
      [Provider.OPENCODE_ZEN]: 'OpenCode Zen',
      [Provider.HUGGINGFACE]: 'Hugging Face Inference'
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
