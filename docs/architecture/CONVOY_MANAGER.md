# Convoy Manager Architecture

## Overview
The **Convoy Manager** handles "Convoys," which are logical groupings of related tasks. This abstraction allows CreateSuite to manage larger features or workflows that consist of multiple individual units of work.

## Key Responsibilities
- **Grouping:** Aggregates multiple task IDs under a single Convoy entity.
- **Lifecycle:** Manages the status of the convoy (Active, Completed, Paused).
- **Progress Tracking:** Calculates aggregate progress (percentage complete) based on the status of individual tasks within the convoy.
- **Membership:** Adds or removes tasks from existing convoys.

## Data Structure
Convoys are defined by the `Convoy` interface:

```typescript
export interface Convoy {
  id: string;              // Format: cs-cv-xxxxx
  name: string;
  description: string;
  tasks: string[];         // Array of Task IDs
  createdAt: Date;
  status: ConvoyStatus;    // ACTIVE, COMPLETED, PAUSED
}
```

## Logic
- **Creation:** Validates that all initial task IDs exist before creating the convoy.
- **Progress Calculation:** Dynamically queries the `TaskManager` for the status of each linked task to compute real-time progress stats (Total, Completed, InProgress, Open).

## Integration Points
- **TaskManager:** Heavily relies on `TaskManager` to validate tasks and retrieve their current status.
- **ConfigManager:** Persists convoy data.

## Usage Example
```typescript
const convoyManager = new ConvoyManager(workspaceRoot);
const convoy = await convoyManager.createConvoy('User Auth Feature', 'Implement full auth flow', ['cs-1', 'cs-2']);
const progress = await convoyManager.getConvoyProgress(convoy.id);
console.log(`${progress.percentage}% complete`);
```
