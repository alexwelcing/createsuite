import { OAuthManager } from '../src/oauthManager';
import { createTempTestDir, cleanupTestDir, mockEnv, expectAsync } from './utils';
import fs from 'fs';

describe('OAuthManager', () => {
  let oauthManager: OAuthManager;
  let testDir: string;
  let mockRestore: () => void;

  beforeEach(() => {
    testDir = createTempTestDir();
    mockRestore = mockEnv({
      OAUTH_CLIENT_ID: 'test-client-id',
      OAUTH_CLIENT_SECRET: 'test-client-secret'
    });
    oauthManager = new OAuthManager(testDir);
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    mockRestore();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct workspace path', () => {
      expect(oauthManager).toBeDefined();
      expect((oauthManager as any).workspaceRoot).toBe(testDir);
    });

    it('should load OAuth configuration from environment', () => {
      const config = oauthManager.getOAuthConfig();
      
      expect(config.clientId).toBe('test-client-id');
      expect(config.scopes).toContain('repo');
      expect(config.scopes).toContain('workflow');
      expect(config.scopes).toContain('read:org');
    });

    it('should handle missing environment variables', () => {
      mockRestore();
      mockRestore = mockEnv({});
      
      const config = oauthManager.getOAuthConfig();
      
      expect(config.clientId).toBeUndefined();
    });
  });

  describe('initializeOAuth (placeholder implementation)', () => {
    it('should store development placeholder token', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation();

      const config = oauthManager.getOAuthConfig();
      await oauthManager.initializeOAuth(config);

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('oauth_token.json'),
        expect.stringContaining('dev_placeholder_token'),
        expect.objectContaining({ mode: 0o600 })
      );
    });

    it('should handle file system errors during token storage', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const config = oauthManager.getOAuthConfig();
      
      await expectAsync.toThrow(
        () => oauthManager.initializeOAuth(config),
        'Write failed'
      );
    });

    it('should create secure token file permissions', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation();

      const config = oauthManager.getOAuthConfig();
      await oauthManager.initializeOAuth(config);

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should create credentials directory if it does not exist', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation();
      mockedFs.writeFileSync.mockImplementation();

      const config = oauthManager.getOAuthConfig();
      await oauthManager.initializeOAuth(config);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.createsuite/credentials'),
        { recursive: true }
      );
    });
  });

  describe('storeToken', () => {
    it('should store token with expiration time', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation();

      await (oauthManager as any).storeToken('test-token', 3600);

      const expectedTokenData = {
        access_token: 'test-token',
        expires_in: 3600,
        created_at: expect.any(String)
      };

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('oauth_token.json'),
        JSON.stringify(expectedTokenData, null, 2),
        { mode: 0o600 }
      );
    });

    it('should handle zero expiration time', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation();

      await (oauthManager as any).storeToken('test-token', 0);

      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const tokenData = JSON.parse(writeCall[1] as string);
      
      expect(tokenData.expires_in).toBe(0);
    });

    it('should handle negative expiration time', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation();

      await (oauthManager as any).storeToken('test-token', -100);

      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const tokenData = JSON.parse(writeCall[1] as string);
      
      expect(tokenData.expires_in).toBe(-100);
    });
  });

  describe('loadToken', () => {
    beforeEach(() => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
    });

    it('should load valid token from file', async () => {
      const mockTokenData = {
        access_token: 'stored-token',
        expires_in: 3600,
        created_at: new Date().toISOString()
      };

      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockTokenData));

      const token = await (oauthManager as any).loadToken();

      expect(token).toEqual(mockTokenData);
    });

    it('should return null for non-existent token file', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(false);

      const token = await (oauthManager as any).loadToken();

      expect(token).toBeNull();
    });

    it('should handle corrupted token file', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.readFileSync.mockReturnValue('invalid json');

      await expectAsync.toThrow(
        () => (oauthManager as any).loadToken(),
        /Unexpected token/
      );
    });

    it('should validate token structure', async () => {
      const invalidToken = { invalid: 'structure' };
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(invalidToken));

      await expectAsync.toThrow(
        () => (oauthManager as any).loadToken(),
        'Invalid token structure'
      );
    });
  });

  describe('isTokenExpired', () => {
    it('should detect expired tokens', () => {
      const expiredToken = {
        access_token: 'token',
        expires_in: 3600,
        created_at: new Date(Date.now() - 7200 * 1000).toISOString() // 2 hours ago
      };

      const isExpired = (oauthManager as any).isTokenExpired(expiredToken);
      expect(isExpired).toBe(true);
    });

    it('should detect valid tokens', () => {
      const validToken = {
        access_token: 'token',
        expires_in: 3600,
        created_at: new Date(Date.now() - 1800 * 1000).toISOString() // 30 minutes ago
      };

      const isExpired = (oauthManager as any).isTokenExpired(validToken);
      expect(isExpired).toBe(false);
    });

    it('should handle tokens with zero expiration', () => {
      const neverExpireToken = {
        access_token: 'token',
        expires_in: 0,
        created_at: new Date().toISOString()
      };

      const isExpired = (oauthManager as any).isTokenExpired(neverExpireToken);
      expect(isExpired).toBe(false);
    });

    it('should handle tokens without created_at field', () => {
      const tokenWithoutDate = {
        access_token: 'token',
        expires_in: 3600
      } as any;

      const isExpired = (oauthManager as any).isTokenExpired(tokenWithoutDate);
      expect(isExpired).toBe(true); // Should consider invalid tokens as expired
    });

    it('should handle tokens with invalid date format', () => {
      const tokenWithInvalidDate = {
        access_token: 'token',
        expires_in: 3600,
        created_at: 'invalid-date'
      };

      const isExpired = (oauthManager as any).isTokenExpired(tokenWithInvalidDate);
      expect(isExpired).toBe(true);
    });
  });

  describe('getValidToken', () => {
    it('should return valid non-expired token', async () => {
      const validToken = {
        access_token: 'valid-token',
        expires_in: 3600,
        created_at: new Date(Date.now() - 1800 * 1000).toISOString() // 30 minutes ago
      };

      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(validToken));

      const token = await oauthManager.getValidToken();
      expect(token).toBe('valid-token');
    });

    it('should return null for expired token', async () => {
      const expiredToken = {
        access_token: 'expired-token',
        expires_in: 3600,
        created_at: new Date(Date.now() - 7200 * 1000).toISOString() // 2 hours ago
      };

      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(expiredToken));

      const token = await oauthManager.getValidToken();
      expect(token).toBeNull();
    });

    it('should return null when no token file exists', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(false);

      const token = await oauthManager.getValidToken();
      expect(token).toBeNull();
    });

    it('should handle file system errors gracefully', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const token = await oauthManager.getValidToken();
      expect(token).toBeNull();
    });
  });

  describe('clearToken', () => {
    it('should delete token file if it exists', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.unlinkSync.mockImplementation();

      await oauthManager.clearToken();

      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('oauth_token.json')
      );
    });

    it('should not fail if token file does not exist', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(false);

      await expect(oauthManager.clearToken()).resolves.not.toThrow();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle file deletion errors', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.unlinkSync.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expectAsync.toThrow(
        () => oauthManager.clearToken(),
        'Delete failed'
      );
    });
  });

  describe('edge cases and security', () => {
    it('should handle workspace path with special characters', () => {
      const specialPath = '/path/with spaces/and$special&chars';
      const manager = new OAuthManager(specialPath);
      
      expect(manager).toBeDefined();
      expect((manager as any).workspaceRoot).toBe(specialPath);
    });

    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(10000);
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation();

      await (oauthManager as any).storeToken(longToken, 3600);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(longToken),
        expect.objectContaining({ mode: 0o600 })
      );
    });

    it('should handle empty token', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation();

      await (oauthManager as any).storeToken('', 3600);

      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const tokenData = JSON.parse(writeCall[1] as string);
      
      expect(tokenData.access_token).toBe('');
    });

    it('should handle concurrent token operations', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.writeFileSync.mockImplementation();
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({
        access_token: 'test-token',
        expires_in: 3600,
        created_at: new Date().toISOString()
      }));

      const operations = [
        (oauthManager as any).storeToken('token1', 3600),
        (oauthManager as any).storeToken('token2', 3600),
        oauthManager.getValidToken(),
        oauthManager.getValidToken()
      ];

      await Promise.all(operations);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should validate configuration object structure', () => {
      mockRestore();
      mockRestore = mockEnv({ OAUTH_CLIENT_ID: '' }); // Empty client ID

      const config = oauthManager.getOAuthConfig();
      
      expect(config.scopes).toEqual(['repo', 'workflow', 'read:org']);
      expect(config.clientId).toBe('');
    });
  });

  describe('production readiness warnings', () => {
    it('should identify placeholder implementation as development-only', async () => {
      // The current implementation is clearly marked as a placeholder
      // This test ensures we're aware this needs real implementation
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const config = oauthManager.getOAuthConfig();
      await oauthManager.initializeOAuth(config);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Development placeholder token stored')
      );

      consoleSpy.mockRestore();
    });
  });
});