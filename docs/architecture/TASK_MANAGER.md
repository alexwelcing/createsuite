# Task Manager Architecture

## Overview
The **Task Manager** is responsible for the complete lifecycle of tasks within the CreateSuite system. It provides a robust interface for creating, updating, tracking, and organizing tasks, ensuring that all work is properly accounted for.

## Key Responsibilities
- **Task Creation:** Generates unique task IDs and initializes task objects.
- **Task Retrieval:** Fetches task details from the persistent store.
- **State Management:** Updates task status (Open, In Progress, Completed, Blocked) and details.
- **Assignment:** Links tasks to specific agents.
- **Filtering:** Provides search capabilities based on status, agent, or priority.

## Data Structure
Tasks are defined by the `Task` interface:

```typescript
export interface Task {
  id: string;              // Format: cs-xxxxx
  title: string;
  description: string;
  status: TaskStatus;      // OPEN, IN_PROGRESS, COMPLETED, BLOCKED
  assignedAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  priority: TaskPriority;  // LOW, MEDIUM, HIGH, CRITICAL
  tags: string[];
}
```

## Integration Points
- **ConfigManager:** Uses the `ConfigManager` for persisting task data to the filesystem/git.
- **AgentOrchestrator:** Tasks are assigned to agents managed by the orchestrator.
- **ConvoyManager:** Tasks can be grouped into convoys for larger workflows.

## Usage Example
```typescript
const taskManager = new TaskManager(workspaceRoot);
const newTask = await taskManager.createTask('Fix login bug', 'User cannot log in', TaskPriority.HIGH);
await taskManager.assignTask(newTask.id, 'agent-123');
```
