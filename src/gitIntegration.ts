import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Git integration for task tracking and persistence
 * Inspired by Gastown's git-backed hooks system
 */
export class GitIntegration {
  private git: SimpleGit;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.git = simpleGit(workspaceRoot);
  }

  /**
   * Initialize git repository if not already initialized
   */
  async initialize(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    
    if (!isRepo) {
      await this.git.init();
      
      // Create initial .gitignore if it doesn't exist
      const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        const gitignoreContent = `
# Dependencies
node_modules/

# Build outputs
dist/

# Logs
logs/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Temporary files
*.tmp
*.temp
`;
        fs.writeFileSync(gitignorePath, gitignoreContent.trim());
      }

      // Initial commit
      await this.git.add('.');
      await this.git.commit('Initial commit: CreateSuite workspace setup');
    }
  }

  /**
   * Commit changes to task tracking data
   */
  async commitTaskChanges(message: string): Promise<void> {
    // Add all changes in .createsuite directory
    await this.git.add('.createsuite/.');
    
    // Check if there are changes to commit
    const status = await this.git.status();
    if (status.files.length > 0) {
      await this.git.commit(message);
    }
  }

  /**
   * Create a branch for agent work
   */
  async createAgentBranch(agentId: string, taskId: string): Promise<string> {
    const branchName = `agent/${agentId}/${taskId}`;
    
    try {
      await this.git.checkoutLocalBranch(branchName);
    } catch (error) {
      // Branch might already exist
      await this.git.checkout(branchName);
    }
    
    return branchName;
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'main';
  }

  /**
   * Switch back to main branch
   */
  async switchToMain(): Promise<void> {
    try {
      await this.git.checkout('main');
    } catch {
      // If main doesn't exist, try master
      await this.git.checkout('master');
    }
  }

  /**
   * Get git status
   */
  async getStatus(): Promise<string> {
    const status = await this.git.status();
    return JSON.stringify(status, null, 2);
  }

  /**
   * Get git log
   */
  async getLog(maxCount: number = 10): Promise<any[]> {
    const log = await this.git.log({ maxCount });
    return [...log.all];
  }

  /**
   * Stage all changes in .createsuite directory
   */
  async stageTaskData(): Promise<void> {
    await this.git.add('.createsuite/.');
  }

  /**
   * Check if working directory is clean
   */
  async isClean(): Promise<boolean> {
    const status = await this.git.status();
    return status.isClean();
  }
}
