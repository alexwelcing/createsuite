# Agent Orchestrator Architecture

## Overview
The **Agent Orchestrator** is the central nervous system of CreateSuite. It manages the lifecycle of AI agents, handles their communication, and coordinates their execution environments (terminals).

## Key Responsibilities
- **Lifecycle Management:** Creates, initializes, and stops agent instances.
- **State Tracking:** Monitors agent status (Idle, Working, Offline, Error).
- **Communication:** Manages an internal mailbox system for inter-agent and system-to-agent messaging.
- **Terminal Orchestration:** Spawns and manages OpenCode terminal sessions for agents to execute their work.
- **Task Assignment:** Delegates specific tasks to agents and sets their context.

## Data Structure
Agents are defined by the `Agent` interface:

```typescript
export interface Agent {
  id: string;              // UUID
  name: string;
  status: AgentStatus;     // IDLE, WORKING, OFFLINE, ERROR
  currentTask?: string;    // Associated Task ID
  terminalPid?: number;    // Process ID of the agent's terminal
  mailbox: Message[];      // Queue of messages
  capabilities: string[];  // Skills (e.g., 'frontend', 'backend')
  createdAt: Date;
}
```

## Communication Model
The orchestrator implements an asynchronous messaging pattern:
- **Messages:** Agents receive `Message` objects containing `from`, `to`, `subject`, and `body`.
- **Mailbox:** Each agent has a `mailbox` array that acts as a queue for incoming instructions or notifications.

## Terminal Integration
The orchestrator is responsible for spawning the `opencode` CLI in a secure, sanitized shell environment for each agent. This allows agents to interact with the codebase directly.

## Usage Example
```typescript
const orchestrator = new AgentOrchestrator(workspaceRoot);
const agent = await orchestrator.createAgent('FrontendDev', ['frontend']);
await orchestrator.assignTaskToAgent(agent.id, 'cs-12345');
```
