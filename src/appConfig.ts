/**
 * Application configuration management for CreateSuite
 * Centralizes environment variables and settings
 */

export interface AppConfig {
  // OAuth Configuration
  oauth: {
    clientId?: string;
    clientSecret?: string;
    redirectPort: number;
    scopes: string[];
  };
  
  // Server Configuration
  server: {
    port: number;
    host: string;
    cors: {
      origin: string[];
      credentials: boolean;
    };
    rateLimit: {
      windowMs: number;
      max: number;
    };
  };

  // Agent Configuration
  agents: {
    defaultProvider: string;
    maxConcurrentAgents: number;
    timeoutMs: number;
  };

  // Logging Configuration
  logging: {
    level: string;
    format: 'json' | 'pretty';
    enableColors: boolean;
  };

  // Fly.io Configuration
  flyio: {
    apiToken?: string;
    appName?: string;
    region: string;
    machineConfig: {
      cpu_kind: string;
      cpus: number;
      memory_mb: number;
    };
  };

  // GitHub Integration
  github: {
    token?: string;
    defaultBranch: string;
    webhookSecret?: string;
  };

  // Provider Configuration
  providers: {
    openai: {
      apiKey?: string;
      baseUrl: string;
      defaultModel: string;
    };
    anthropic: {
      apiKey?: string;
      baseUrl: string;
      defaultModel: string;
    };
    google: {
      apiKey?: string;
      defaultModel: string;
    };
  };
}

class AppConfigManager {
  private static instance: AppConfigManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): AppConfigManager {
    if (!AppConfigManager.instance) {
      AppConfigManager.instance = new AppConfigManager();
    }
    return AppConfigManager.instance;
  }

  private loadConfig(): AppConfig {
    return {
      oauth: {
        clientId: process.env.OAUTH_CLIENT_ID || process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET,
        redirectPort: parseInt(process.env.OAUTH_REDIRECT_PORT || '8080', 10),
        scopes: (process.env.OAUTH_SCOPES || 'repo,workflow,read:org,user:email').split(','),
      },

      server: {
        port: parseInt(process.env.PORT || '3001', 10),
        host: process.env.HOST || 'localhost',
        cors: {
          origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
          credentials: process.env.CORS_CREDENTIALS === 'true',
        },
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
          max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        },
      },

      agents: {
        defaultProvider: process.env.DEFAULT_PROVIDER || 'openai',
        maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '5', 10),
        timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '300000', 10), // 5 minutes
      },

      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: (process.env.LOG_FORMAT as 'json' | 'pretty') || 
                (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
        enableColors: process.env.LOG_COLORS !== 'false' && process.env.NODE_ENV !== 'production',
      },

      flyio: {
        apiToken: process.env.FLY_API_TOKEN,
        appName: process.env.FLY_APP_NAME || 'createsuite',
        region: process.env.FLY_REGION || 'ord',
        machineConfig: {
          cpu_kind: process.env.FLY_CPU_KIND || 'shared',
          cpus: parseInt(process.env.FLY_CPUS || '1', 10),
          memory_mb: parseInt(process.env.FLY_MEMORY_MB || '512', 10),
        },
      },

      github: {
        token: process.env.GITHUB_TOKEN,
        defaultBranch: process.env.GITHUB_DEFAULT_BRANCH || 'main',
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
      },

      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
          defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4',
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
          defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-sonnet-20240229',
        },
        google: {
          apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
          defaultModel: process.env.GOOGLE_DEFAULT_MODEL || 'gemini-pro',
        },
      },
    };
  }

  public get(): AppConfig {
    return this.config;
  }

  public getOAuth() {
    return this.config.oauth;
  }

  public getServer() {
    return this.config.server;
  }

  public getAgents() {
    return this.config.agents;
  }

  public getLogging() {
    return this.config.logging;
  }

  public getFlyio() {
    return this.config.flyio;
  }

  public getGitHub() {
    return this.config.github;
  }

  public getProviders() {
    return this.config.providers;
  }

  /**
   * Validate configuration and throw errors for missing required values
   */
  public validate(): void {
    const errors: string[] = [];

    // Check OAuth configuration if OAuth is being used
    if (!this.config.oauth.clientId) {
      errors.push('OAuth client ID is required. Set OAUTH_CLIENT_ID or GITHUB_CLIENT_ID environment variable.');
    }

    // Check provider configuration
    if (!this.config.providers.openai.apiKey && 
        !this.config.providers.anthropic.apiKey && 
        !this.config.providers.google.apiKey) {
      errors.push('At least one AI provider API key is required. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY.');
    }

    // Check Fly.io configuration for production deployment
    if (process.env.NODE_ENV === 'production' && !this.config.flyio.apiToken) {
      errors.push('Fly.io API token is required for production deployment. Set FLY_API_TOKEN environment variable.');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.map(e => `- ${e}`).join('\n')}`);
    }
  }

  /**
   * Get environment-specific configuration
   */
  public isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  }

  public isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }
}

// Export singleton instance
export const appConfig = AppConfigManager.getInstance();