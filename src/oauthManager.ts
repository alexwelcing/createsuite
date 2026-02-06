import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http from 'http';
import * as url from 'url';
import { OAuthConfig } from './types';
import { oauthLogger } from './logger';
import { appConfig } from './appConfig';

/**
 * Token data structure for OAuth storage
 */
interface TokenData {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  createdAt: string;
  expiresAt?: string;
  scope?: string;
}

/**
 * OAuth state data for PKCE flow
 */
interface OAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

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
  async storeToken(accessToken: string, expiresIn?: number, refreshToken?: string, tokenType: string = 'Bearer', scope?: string): Promise<void> {
    const tokenData: TokenData = {
      accessToken,
      refreshToken,
      tokenType,
      createdAt: new Date().toISOString(),
      scope
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
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate secure random state parameter
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Start OAuth callback server
   */
  private async startCallbackServer(port?: number): Promise<{ server: http.Server; url: string }> {
    const callbackPort = port || appConfig.getOAuth().redirectPort;
    const server = http.createServer();
    
    return new Promise((resolve, reject) => {
      server.listen(callbackPort, 'localhost', () => {
        const url = `http://localhost:${callbackPort}/callback`;
        resolve({ server, url });
      });
      
      server.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Initialize OAuth flow with proper PKCE implementation
   */
  async initializeOAuth(config: OAuthConfig): Promise<void> {
    const oauthConfig = appConfig.getOAuth();
    
    if (!config.clientId && !oauthConfig.clientId) {
      throw new Error('OAuth client ID is required. Set OAUTH_CLIENT_ID environment variable.');
    }

    const clientId = config.clientId || oauthConfig.clientId!;
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const state = this.generateState();
    
    try {
      const { server, url: callbackUrl } = await this.startCallbackServer();
      
      // Build authorization URL
      const authParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: config.scopes.join(' '),
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        response_type: 'code'
      });

      const authUrl = `https://github.com/login/oauth/authorize?${authParams}`;
      
      oauthLogger.oauth('Starting OAuth 2.0 flow with PKCE', { 
        scopes: config.scopes,
        clientId: clientId?.substring(0, 8) + '...',
        callbackUrl 
      });
      oauthLogger.info(`Please visit: ${authUrl}`);
      
      // Try to open browser automatically
      const { spawn } = await import('child_process');
      try {
        const openCommand = process.platform === 'darwin' ? 'open' : 
                          process.platform === 'win32' ? 'start' : 'xdg-open';
        spawn(openCommand, [authUrl], { detached: true, stdio: 'ignore' });
      } catch {
        // Browser opening failed, user will need to copy URL
      }

      // Wait for callback
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          server.close();
          reject(new Error('OAuth flow timed out after 5 minutes'));
        }, 5 * 60 * 1000); // 5 minute timeout

        server.on('request', async (req, res) => {
          try {
            const parsedUrl = url.parse(req.url!, true);
            
            if (parsedUrl.pathname !== '/callback') {
              res.writeHead(404);
              res.end('Not found');
              return;
            }

            const { code, state: returnedState, error } = parsedUrl.query;

            // Send response to browser
            if (error) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body>
                    <h1>OAuth Error</h1>
                    <p>Authorization failed: ${error}</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              clearTimeout(timeout);
              server.close();
              reject(new Error(`OAuth authorization failed: ${error}`));
              return;
            }

            // Validate state parameter to prevent CSRF
            if (returnedState !== state) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body>
                    <h1>Security Error</h1>
                    <p>Invalid state parameter. This may be a CSRF attack.</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              clearTimeout(timeout);
              server.close();
              reject(new Error('Invalid state parameter - possible CSRF attack'));
              return;
            }

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body>
                    <h1>OAuth Error</h1>
                    <p>No authorization code received.</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              clearTimeout(timeout);
              server.close();
              reject(new Error('No authorization code received'));
              return;
            }

            // Exchange code for token
            try {
              await this.exchangeCodeForToken(clientId, code as string, callbackUrl, codeVerifier);
              
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body>
                    <h1>✓ Authorization Successful</h1>
                    <p>CreateSuite has been authorized successfully!</p>
                    <p>You can close this window and return to your terminal.</p>
                    <script>setTimeout(() => window.close(), 3000);</script>
                  </body>
                </html>
              `);
              
              clearTimeout(timeout);
              server.close();
              resolve();
            } catch (tokenError) {
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body>
                    <h1>Token Exchange Error</h1>
                    <p>Failed to exchange authorization code for access token.</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              clearTimeout(timeout);
              server.close();
              reject(tokenError);
            }
          } catch (callbackError) {
            clearTimeout(timeout);
            server.close();
            reject(callbackError);
          }
        });
      });

      oauthLogger.oauth('OAuth flow completed successfully');
      
    } catch (error) {
      throw new Error(`OAuth initialization failed: ${error}`);
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(clientId: string, code: string, redirectUri: string, codeVerifier: string): Promise<void> {
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code'
    });

    // For GitHub OAuth, use client secret if available
    const clientSecret = appConfig.getOAuth().clientSecret;
    if (clientSecret) {
      tokenParams.append('client_secret', clientSecret);
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'CreateSuite CLI'
      },
      body: tokenParams.toString()
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }

    const tokenData = await response.json();
    
    if (tokenData.error) {
      throw new Error(`Token exchange error: ${tokenData.error_description || tokenData.error}`);
    }

    // Store the token
    await this.storeToken(
      tokenData.access_token,
      tokenData.expires_in,
      tokenData.refresh_token,
      tokenData.token_type || 'Bearer',
      tokenData.scope
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<void> {
    const tokenData = await this.getStoredTokenData();
    if (!tokenData || !tokenData.refreshToken) {
      throw new Error('No refresh token available');
    }

    const oauthConfig = appConfig.getOAuth();
    if (!oauthConfig.clientId) {
      throw new Error('OAuth client ID is required for token refresh');
    }

    const refreshParams = new URLSearchParams({
      client_id: oauthConfig.clientId,
      refresh_token: tokenData.refreshToken,
      grant_type: 'refresh_token'
    });

    const clientSecret = oauthConfig.clientSecret;
    if (clientSecret) {
      refreshParams.append('client_secret', clientSecret);
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'CreateSuite CLI'
      },
      body: refreshParams.toString()
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }

    const newTokenData = await response.json();
    
    if (newTokenData.error) {
      throw new Error(`Token refresh error: ${newTokenData.error_description || newTokenData.error}`);
    }

    // Store the new token
    await this.storeToken(
      newTokenData.access_token,
      newTokenData.expires_in,
      newTokenData.refresh_token || tokenData.refreshToken, // Keep old refresh token if new one not provided
      newTokenData.token_type || 'Bearer',
      newTokenData.scope
    );
  }

  /**
   * Get stored token data (internal method)
   */
  private async getStoredTokenData(): Promise<TokenData | null> {
    try {
      await fsp.access(this.tokenPath);
    } catch {
      return null;
    }

    try {
      const data = await fsp.readFile(this.tokenPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Get OAuth config
   */
  getOAuthConfig(): OAuthConfig {
    const config = appConfig.getOAuth();
    return {
      scopes: config.scopes,
      clientId: config.clientId
    };
  }
}
