import * as fs from 'fs';
import * as path from 'path';
import { OAuthConfig } from './types';

/**
 * OAuth integration for coding plan authentication
 */
export class OAuthManager {
  private workspaceRoot: string;
  private tokenPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.tokenPath = path.join(workspaceRoot, '.createsuite', 'oauth-token.json');
  }

  /**
   * Check if OAuth token exists and is valid
   */
  async hasValidToken(): Promise<boolean> {
    if (!fs.existsSync(this.tokenPath)) {
      return false;
    }

    try {
      const tokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
      
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
    if (!fs.existsSync(this.tokenPath)) {
      return null;
    }

    try {
      const tokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
      return tokenData.accessToken || null;
    } catch {
      return null;
    }
  }

  /**
   * Store OAuth token
   */
  async storeToken(accessToken: string, expiresIn?: number): Promise<void> {
    const tokenData: any = {
      accessToken,
      createdAt: new Date().toISOString()
    };

    if (expiresIn) {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
      tokenData.expiresAt = expiresAt.toISOString();
    }

    const tokenDir = path.dirname(this.tokenPath);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }

    fs.writeFileSync(this.tokenPath, JSON.stringify(tokenData, null, 2), {
      mode: 0o600 // Restrict permissions
    });
  }

  /**
   * Clear stored token
   */
  async clearToken(): Promise<void> {
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
  }

  /**
   * Initialize OAuth flow (placeholder)
   * In production, this would open browser for OAuth flow
   * 
   * WARNING: This is a development placeholder. In production:
   * - Implement proper OAuth 2.0 flow with PKCE
   * - Use a secure callback server
   * - Validate state parameter
   * - Exchange authorization code for real access token
   */
  async initializeOAuth(config: OAuthConfig): Promise<void> {
    console.log('⚠️  DEVELOPMENT MODE: OAuth Flow Placeholder');
    console.log('Scopes:', config.scopes.join(', '));
    console.log('\nIn production, this would:');
    console.log('1. Open browser to authorization URL');
    console.log('2. Handle callback with authorization code');
    console.log('3. Exchange code for access token');
    console.log('4. Store token securely');
    
    // Development placeholder - DO NOT use in production
    // Store a marker token to indicate OAuth was initiated
    await this.storeToken('dev_placeholder_token', 3600);
    console.log('\n✓ Development placeholder token stored');
  }

  /**
   * Get OAuth config
   */
  getOAuthConfig(): OAuthConfig {
    return {
      scopes: ['repo', 'workflow', 'read:org'],
      clientId: process.env.OAUTH_CLIENT_ID
    };
  }
}
