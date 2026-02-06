# Git Integration Architecture

## Overview
The **Git Integration** module provides the persistence layer for CreateSuite's unique "Git-Backed Persistence" model. Instead of relying solely on a database, CreateSuite stores its state (tasks, agents, convoys) in the filesystem and version-controls them using Git.

## Key Responsibilities
- **Initialization:** Ensures the workspace is a valid git repository and sets up necessary `.gitignore` rules.
- **Persistence:** Commits changes made to the `.createsuite` directory, ensuring a history of all state changes.
- **Branch Management:** Creates dedicated branches (`agent/{agentId}/{taskId}`) for agents to work in isolation.
- **Status & Monitoring:** Provides wrappers around `git status`, `git log`, and other commands to monitor the workspace state.

## Workflow
1. **Setup:** Checks for `.git`. If missing, runs `git init` and commits a default `.gitignore`.
2. **State Saving:** When `ConfigManager` saves a file, `GitIntegration` can be triggered to stage (`git add .createsuite/.`) and commit that change, providing an audit trail.
3. **Agent Isolation:** When an agent starts a task, `createAgentBranch` is called to switch the workspace to a feature branch, preventing conflicts with the main codebase.

## Integration Points
- **ConfigManager:** While `ConfigManager` handles the JSON file I/O, `GitIntegration` handles the version control aspect of those files.
- **AgentOrchestrator:** Uses branch management to isolate agent workspaces.

## Usage Example
```typescript
const git = new GitIntegration(workspaceRoot);
await git.initialize();
await git.createAgentBranch('agent-1', 'cs-task-1');
// ... agent performs work ...
await git.commitTaskChanges('Update task status to IN_PROGRESS');
```
