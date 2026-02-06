import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { OAuthConfig } from './types';

/**
 * Token data structure for OAuth storage
 */
interface TokenData {
  accessToken: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * OAuth integration for coding plan authentication
 */
export class OAuthManager {
  private workspaceRoot: string;
  private tokenPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.tokenPath = path.join(workspaceRoot, '.createsuite', 'credentials', 'oauth_token.json');
  }

  /**
   * Check if OAuth token exists and is valid
   */
  async hasValidToken(): Promise<boolean> {
    try {
      await fsp.access(this.tokenPath);
    } catch {
      return false;
    }

    try {
      const data = await fsp.readFile(this.tokenPath, 'utf-8');
      const tokenData = JSON.parse(data);
      
      // Check if token is expired (simple check)
      if (tokenData.expiresAt) {
        const expiresAt = new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get stored OAuth token
   */
  async getToken(): Promise<string | null> {
    try {
      await fsp.access(this.tokenPath);
    } catch {
      return null;
    }

    try {
      const data = await fsp.readFile(this.tokenPath, 'utf-8');
      const tokenData = JSON.parse(data);
      return tokenData.accessToken || null;
    } catch {
      return null;
    }
  }

  /**
   * Store OAuth token
   */
  async storeToken(accessToken: string, expiresIn?: number): Promise<void> {
    const tokenData: TokenData = {
      accessToken,
      createdAt: new Date().toISOString()
    };

    if (expiresIn) {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
      tokenData.expiresAt = expiresAt.toISOString();
    }

    const tokenDir = path.dirname(this.tokenPath);
    try {
      await fsp.access(tokenDir);
    } catch {
      await fsp.mkdir(tokenDir, { recursive: true });
    }

    await fsp.writeFile(this.tokenPath, JSON.stringify(tokenData, null, 2), {
      mode: 0o600 // Restrict permissions
    });
  }

  /**
   * Clear stored token
   */
  async clearToken(): Promise<void> {
    try {
      await fsp.access(this.tokenPath);
      await fsp.unlink(this.tokenPath);
    } catch {
      // Token doesn't exist, nothing to clear
    }
  }

  /**
   * Initialize OAuth flow with proper PKCE implementation
   * Uses localhost callback server for secure token exchange
   */
  async initializeOAuth(config: OAuthConfig): Promise<void> {
    if (!config.clientId) {
      throw new Error('OAuth client ID is required. Please set OAUTH_CLIENT_ID environment variable.');
    }

    console.log('🔐 Starting OAuth flow...');
    console.log('Scopes:', config.scopes.join(', '));

    const { LocalhostOAuth } = await import('./localhostOAuth');
    const oauth = new LocalhostOAuth();

    try {
      // GitHub OAuth endpoints
      const tokenResponse = await oauth.startFlow({
        clientId: config.clientId,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: config.scopes.join(' ')
      });

      // Store the real access token
      await this.storeToken(tokenResponse.access_token, tokenResponse.expires_in);
      console.log('\n✅ OAuth authentication successful!');
      console.log('✓ Access token stored securely');
      
    } catch (error) {
      console.error('❌ OAuth flow failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get OAuth config with validation
   */
  getOAuthConfig(): OAuthConfig {
    const clientId = process.env.OAUTH_CLIENT_ID;
    
    if (!clientId) {
      console.warn('⚠️  OAUTH_CLIENT_ID environment variable not set');
    }

    return {
      scopes: ['repo', 'workflow', 'read:org'],
      clientId
    };
  }

  /**
   * Get valid token (implements proper interface expected by tests)
   */
  async getValidToken(): Promise<string | null> {
    try {
      const tokenData = await this.loadToken();
      if (!tokenData) return null;
      
      if (this.isTokenExpired(tokenData)) {
        return null;
      }
      
      return tokenData.access_token;
    } catch (error) {
      // Handle file system errors gracefully
      return null;
    }
  }

  /**
   * Load token data from file
   */
  private async loadToken(): Promise<{ access_token: string; expires_in: number; created_at: string } | null> {
    try {
      await fsp.access(this.tokenPath);
      const data = await fsp.readFile(this.tokenPath, 'utf-8');
      const tokenData = JSON.parse(data);
      
      // Validate token structure
      if (!tokenData.accessToken || !tokenData.createdAt) {
        throw new Error('Invalid token structure');
      }

      // Convert to expected format
      return {
        access_token: tokenData.accessToken,
        expires_in: tokenData.expiresAt ? 3600 : 0, // Default 1 hour if expires set
        created_at: tokenData.createdAt
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(tokenData: { expires_in: number; created_at: string }): boolean {
    if (!tokenData.created_at || tokenData.expires_in === 0) {
      return tokenData.expires_in === 0 ? false : true;
    }

    try {
      const createdAt = new Date(tokenData.created_at);
      const expiresAt = new Date(createdAt.getTime() + (tokenData.expires_in * 1000));
      return expiresAt < new Date();
    } catch {
      return true; // Consider invalid dates as expired
    }
  }

  /**
   * Store token with expiration
   */
  private async storeToken(token: string, expiresIn?: number): Promise<void> {
    const tokenData = {
      access_token: token,
      expires_in: expiresIn || 0,
      created_at: new Date().toISOString()
    };

    const tokenDir = path.dirname(this.tokenPath);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }

    fs.writeFileSync(this.tokenPath, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
  }
}
