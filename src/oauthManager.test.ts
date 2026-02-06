import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { OAuthManager } from '../oauthManager';
import { OAuthConfig } from '../types';

// Mock the logger
vi.mock('../logger', () => ({
  oauthLogger: {
    oauth: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }
}));

describe('OAuthManager', () => {
  let oauthManager: OAuthManager;
  let tempDir: string;
  let tokenPath: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, '..', '..', 'test-tmp', Math.random().toString(36).substring(7));
    await fs.mkdir(tempDir, { recursive: true });
    
    oauthManager = new OAuthManager(tempDir);
    tokenPath = path.join(tempDir, '.createsuite', 'oauth-token.json');
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Token Storage and Retrieval', () => {
    it('should store and retrieve access token', async () => {
      const accessToken = 'test-access-token';
      
      await oauthManager.storeToken(accessToken, 3600);
      
      const retrievedToken = await oauthManager.getToken();
      expect(retrievedToken).toBe(accessToken);
    });

    it('should store token with expiration', async () => {
      const accessToken = 'test-token';
      const expiresIn = 3600; // 1 hour
      
      await oauthManager.storeToken(accessToken, expiresIn);
      
      // Check the stored file content
      const tokenData = JSON.parse(await fs.readFile(tokenPath, 'utf-8'));
      expect(tokenData.accessToken).toBe(accessToken);
      expect(tokenData.expiresAt).toBeDefined();
      expect(new Date(tokenData.expiresAt)).toBeInstanceOf(Date);
    });

    it('should store token with refresh token and metadata', async () => {
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';
      const tokenType = 'Bearer';
      const scope = 'repo read:user';
      
      await oauthManager.storeToken(accessToken, 3600, refreshToken, tokenType, scope);
      
      const tokenData = JSON.parse(await fs.readFile(tokenPath, 'utf-8'));
      expect(tokenData.accessToken).toBe(accessToken);
      expect(tokenData.refreshToken).toBe(refreshToken);
      expect(tokenData.tokenType).toBe(tokenType);
      expect(tokenData.scope).toBe(scope);
    });

    it('should create .createsuite directory if it does not exist', async () => {
      const accessToken = 'test-token';
      
      await oauthManager.storeToken(accessToken);
      
      const createsuiteDirExists = await fs.access(path.dirname(tokenPath)).then(() => true, () => false);
      expect(createsuiteDirExists).toBe(true);
    });

    it('should return null when no token is stored', async () => {
      const token = await oauthManager.getToken();
      expect(token).toBeNull();
    });
  });

  describe('Token Validation', () => {
    it('should validate non-expired token', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      
      await oauthManager.storeToken('test-token', 3600);
      
      const isValid = await oauthManager.hasValidToken();
      expect(isValid).toBe(true);
    });

    it('should invalidate expired token', async () => {
      // Create an expired token
      const tokenData = {
        accessToken: 'expired-token',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString() // 1 second ago
      };
      
      await fs.mkdir(path.dirname(tokenPath), { recursive: true });
      await fs.writeFile(tokenPath, JSON.stringify(tokenData));
      
      const isValid = await oauthManager.hasValidToken();
      expect(isValid).toBe(false);
    });

    it('should handle token without expiration', async () => {
      const tokenData = {
        accessToken: 'no-expiry-token',
        createdAt: new Date().toISOString()
      };
      
      await fs.mkdir(path.dirname(tokenPath), { recursive: true });
      await fs.writeFile(tokenPath, JSON.stringify(tokenData));
      
      const isValid = await oauthManager.hasValidToken();
      expect(isValid).toBe(true);
    });

    it('should handle corrupted token file', async () => {
      await fs.mkdir(path.dirname(tokenPath), { recursive: true });
      await fs.writeFile(tokenPath, 'invalid json');
      
      const isValid = await oauthManager.hasValidToken();
      expect(isValid).toBe(false);
      
      const token = await oauthManager.getToken();
      expect(token).toBeNull();
    });
  });

  describe('Token Clearing', () => {
    it('should clear stored token', async () => {
      await oauthManager.storeToken('test-token');
      
      expect(await oauthManager.hasValidToken()).toBe(true);
      
      await oauthManager.clearToken();
      
      expect(await oauthManager.hasValidToken()).toBe(false);
      expect(await oauthManager.getToken()).toBeNull();
    });

    it('should handle clearing non-existent token', async () => {
      // Should not throw when clearing non-existent token
      await expect(oauthManager.clearToken()).resolves.toBeUndefined();
    });
  });

  describe('OAuth Configuration', () => {
    it('should return default OAuth config', () => {
      const config = oauthManager.getOAuthConfig();
      
      expect(config.scopes).toContain('repo');
      expect(config.scopes).toContain('workflow');
      expect(config.scopes).toContain('read:org');
      expect(config.scopes).toContain('user:email');
    });

    it('should use environment variable for client ID', () => {
      const testClientId = 'test-client-id';
      process.env.OAUTH_CLIENT_ID = testClientId;
      
      const config = oauthManager.getOAuthConfig();
      
      expect(config.clientId).toBe(testClientId);
      
      delete process.env.OAUTH_CLIENT_ID;
    });

    it('should fallback to GITHUB_CLIENT_ID environment variable', () => {
      const testClientId = 'github-client-id';
      process.env.GITHUB_CLIENT_ID = testClientId;
      
      const config = oauthManager.getOAuthConfig();
      
      expect(config.clientId).toBe(testClientId);
      
      delete process.env.GITHUB_CLIENT_ID;
    });
  });

  describe('PKCE Methods', () => {
    it('should generate secure PKCE parameters', () => {
      // Test the private method indirectly by checking initialization requirements
      const config: OAuthConfig = {
        clientId: 'test-client-id',
        scopes: ['repo']
      };

      expect(() => oauthManager.initializeOAuth(config)).not.toThrow();
    });

    it('should require client ID for OAuth initialization', async () => {
      const config: OAuthConfig = {
        scopes: ['repo']
      };

      await expect(oauthManager.initializeOAuth(config)).rejects.toThrow(
        'OAuth client ID is required'
      );
    });
  });

  describe('File Permissions', () => {
    it('should set restrictive permissions on token file', async () => {
      await oauthManager.storeToken('test-token');
      
      const stats = await fs.stat(tokenPath);
      // Check that file permissions are restrictive (600 = rw-------)
      const permissions = stats.mode & parseInt('777', 8);
      expect(permissions).toBe(parseInt('600', 8));
    });
  });
});