# 60-Second Demo Script: CreateSuite First-Time Experience

**Target Audience**: Small team lead (2-5 developers) evaluating AI coding tools  
**Goal**: Demonstrate value within 60 seconds, create "wow moment", show ease of use  
**Paths**: CLI-first AND Desktop-first (both documented)

---

## Path A: CLI-First Experience

### Scene 1: Entry (0-10 seconds)

**User action**: Opens terminal in their existing React project, runs `npx createsuite`

**What they see**:
```
$ npx createsuite
✨ Welcome to CreateSuite - Your AI Agent Team Command Center

🔍 Detecting your project...
   ✓ Found: TypeScript React project
   ✓ Detected: package.json, tsconfig.json, src/
   ✓ Project size: 142 files, 8,432 lines of code

Ready to set up your AI agent team? [Y/n]: _
```

**User types**: `Y` ↵

---

### Scene 2: Setup (10-30 seconds)

**What they see**:
```
🤖 Quick Setup (2 questions)

1. Which AI providers do you have access to?
   [x] Claude (Anthropic)
   [x] OpenAI GPT
   [ ] Google Gemini
   [ ] Other providers
   
   → Selected: Claude + OpenAI ✓

2. What's your team working on right now?
   > "Adding dark mode to our dashboard"

✓ Configuration saved to .createsuite/

🎯 CreateSuite is ready! Here's what I can do:

   cs task create "Add dark mode toggle"
   cs ui --demo              # See the desktop app
   cs agent create alice     # Create specialized agents
```

**Time elapsed**: 30 seconds

---

### Scene 3: Wow Moment (30-45 seconds)

**THE WOW MOMENT**: Agent automatically creates a plan and starts working

**User types**: `cs task create "Add dark mode toggle to settings page"`

**What they see**:
```
$ cs task create "Add dark mode toggle to settings page"

✓ Task created: cs-a7f3e

🤔 Analyzing complexity...
   → Detected: UI feature (simple-to-medium complexity)
   → Recommended workflow: Plan → Execute
   
🎯 Prometheus is planning the work...

   ✓ Analyzed codebase structure
   ✓ Found: src/components/Settings.tsx
   ✓ Identified: Theme context in src/contexts/ThemeContext.tsx
   ✓ Generated 4-step plan

📋 Plan: dark-mode-toggle
   1. [ ] Add toggle component to Settings.tsx
   2. [ ] Connect to ThemeContext
   3. [ ] Add localStorage persistence
   4. [ ] Test in light/dark modes

Would you like Sisyphus to execute this plan now? [Y/n]: _
```

**User types**: `Y` ↵

**What they see**:
```
🚀 Sisyphus is working on your task...

   [████████████████░░░░] 75% - Step 3/4
   
   ✓ Added DarkModeToggle component
   ✓ Connected to ThemeContext  
   ⚙ Adding localStorage persistence...

   View progress: cs ui
```

**Time elapsed**: 45 seconds  
**Wow factor**: "It understood my codebase and made a plan automatically!"

---

### Scene 4: First Task (45-60 seconds)

**User types**: `cs ui` (launches Desktop app)

**What they see**: Electron window opens with Windows 95 aesthetic

```
┌─────────────────────────────────────────────────────┐
│ CreateSuite Agent Command Center          [_][□][X] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────┐      │
│  │ 🤖 Sisyphus - Working                    │      │
│  │ Task: cs-a7f3e (dark-mode-toggle)        │      │
│  │                                           │      │
│  │ $ git diff src/components/Settings.tsx   │      │
│  │ +import { DarkModeToggle } from './Dark  │      │
│  │ +  <DarkModeToggle />                    │      │
│  │                                           │      │
│  │ ✓ Step 3 complete                        │      │
│  │ ⚙ Running tests...                       │      │
│  └──────────────────────────────────────────┘      │
│                                                      │
│  📊 Task Progress: 3/4 steps complete               │
│  ⏱ Elapsed: 2m 14s                                  │
│                                                      │
│ [Start] [Agent Village] [System Monitor]    3:42 PM │
└─────────────────────────────────────────────────────┘
```

**User clicks**: "Agent Village" in Start menu

**What they see**: Visual map showing Sisyphus working, with message flow

**Time elapsed**: 60 seconds  
**Final impression**: "This is actually working on my real codebase, and I can see everything happening!"

---

## Path B: Desktop-First Experience

### Scene 1: Entry (0-10 seconds)

**User action**: Runs `npx createsuite` in terminal

**What they see**:
```
$ npx createsuite
✨ Welcome to CreateSuite!

🔍 Detected: Existing TypeScript project
   
Choose your experience:
  1. CLI workflow (terminal-based)
  2. Desktop app (visual command center)
  3. Quick demo (see it in action)

Your choice [1-3]: _
```

**User types**: `3` ↵ (Quick demo)

**What happens**: Electron app launches automatically with `--demo` flag

---

### Scene 2: Setup (10-30 seconds)

**What they see**: Desktop app opens with demo mode active

```
┌─────────────────────────────────────────────────────┐
│ CreateSuite Demo Mode                     [_][□][X] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🎬 Welcome to CreateSuite!                         │
│                                                      │
│  This demo shows 5 AI agents working together       │
│  on a real task: "Build user authentication"        │
│                                                      │
│  ┌────────────────────────────────────────┐        │
│  │ 🤖 Agents Active:                      │        │
│  │                                         │        │
│  │  • Sisyphus (Orchestrator)             │        │
│  │  • Oracle (Debugger)                   │        │
│  │  • Librarian (Docs)                    │        │
│  │  • Frontend Engineer (UI)              │        │
│  │  • Backend Engineer (API)              │        │
│  └────────────────────────────────────────┘        │
│                                                      │
│  Click "Agent Village" to see them work →          │
│                                                      │
│ [Start] [Agent Village] [System Monitor]    3:42 PM │
└─────────────────────────────────────────────────────┘
```

**User clicks**: "Agent Village"

---

### Scene 3: Wow Moment (30-45 seconds)

**THE WOW MOMENT**: Visual map showing 5 agents collaborating in real-time

**What they see**:
```
┌─────────────────────────────────────────────────────┐
│ Agent Village - Live Collaboration       [_][□][X] │
├─────────────────────────────────────────────────────┤
│                                                      │
│         Sisyphus (Orchestrator)                     │
│              ↓                                       │
│         ┌────┴────┐                                 │
│         ↓         ↓                                  │
│    Frontend    Backend                              │
│    Engineer    Engineer                             │
│         ↓         ↓                                  │
│         └────┬────┘                                 │
│              ↓                                       │
│          Librarian ←→ Oracle                        │
│                                                      │
│  💬 Recent Messages:                                │
│  • Sisyphus → Frontend: "Build login form"         │
│  • Frontend → Librarian: "Find React auth examples"│
│  • Librarian → Frontend: "Found 3 patterns"        │
│  • Backend → Oracle: "API endpoint failing"        │
│  • Oracle → Backend: "Try async/await pattern"     │
│                                                      │
│  📊 Progress: 12/20 tasks complete                  │
│                                                      │
│ [Start] [Agent Village] [System Monitor]    3:42 PM │
└─────────────────────────────────────────────────────┘
```

**Time elapsed**: 45 seconds  
**Wow factor**: "I can SEE the agents talking to each other and solving problems!"

---

### Scene 4: First Task (45-60 seconds)

**User clicks**: One of the agent nodes (e.g., "Frontend Engineer")

**What they see**: Terminal window opens showing that agent's actual work

```
┌──────────────────────────────────────────┐
│ 🤖 Frontend Engineer - Gemini 3 Pro  [X] │
├──────────────────────────────────────────┤
│                                           │
│ $ cat src/components/LoginForm.tsx       │
│                                           │
│ import React, { useState } from 'react'; │
│ import { useAuth } from '../hooks/auth'; │
│                                           │
│ export function LoginForm() {            │
│   const [email, setEmail] = useState('');│
│   const [password, setPassword] = ...    │
│   const { login } = useAuth();           │
│                                           │
│   return (                                │
│     <form onSubmit={handleSubmit}>       │
│       <input type="email" ...            │
│                                           │
│ ✓ LoginForm component created            │
│ ⚙ Adding form validation...              │
│                                           │
└──────────────────────────────────────────┘
```

**User realizes**: "This isn't a simulation - these are REAL agents writing REAL code!"

**Time elapsed**: 60 seconds  
**Final impression**: "I need this for my team. Where do I sign up?"

---

## Key Wow Moments Identified

| Moment | Why It's Impressive | Timing |
|--------|---------------------|--------|
| **Auto-detection** | "It understood my project instantly" | 5s |
| **Smart routing** | "It knew this needed planning first" | 35s |
| **Visual collaboration** | "I can SEE agents working together" | 45s |
| **Real code output** | "This isn't a demo - it's actually working!" | 55s |

---

## Success Metrics

After 60 seconds, user should:
- [ ] Understand what CreateSuite does (AI agent orchestration)
- [ ] See it working on a real task (not fake demo data)
- [ ] Experience the "wow moment" (visual collaboration or auto-planning)
- [ ] Know next steps (how to use it on their project)
- [ ] Feel excited to try it ("I need this!")

---

## Technical Requirements for Implementation

### CLI Path Requirements:
1. `npx createsuite` must detect project type (package.json, tsconfig, etc.)
2. Setup wizard must be 2 questions max (providers + current work)
3. `cs task create` must trigger complexity analysis and planning
4. Progress display must show real-time updates

### Desktop Path Requirements:
1. `npx createsuite` with choice menu (CLI/Desktop/Demo)
2. `--demo` flag must launch with 5 pre-configured agents
3. Agent Village must show visual node graph with message flow
4. Clicking agent node must open terminal window with real output

### Both Paths Must:
- Complete in under 60 seconds of user time
- Work on real codebases (not toy examples)
- Show actual AI agent output (not simulated)
- Create genuine "wow moment" between 30-45 seconds
- Leave user knowing exactly what to do next

---

## Notes for Implementation Teams

**For Task 3 (Entry Point CLI)**:
- The `npx createsuite` command must implement the Scene 1 detection logic
- Setup wizard should save to `.createsuite/config.json`
- Choice menu (CLI/Desktop/Demo) is critical for Desktop path

**For Task 5 (Desktop Single-Process)**:
- `cs ui --demo` must launch with demo=true parameter
- Demo mode should auto-spawn 5 agents working on "Build user authentication"
- Agent Village visualization is the core wow moment

**For Task 6 (Smart Router)**:
- Complexity analysis must happen automatically on `cs task create`
- Router should recommend "Plan → Execute" for medium+ complexity
- User should see the recommendation and be able to accept/override

**For Task 7 (Integration Test)**:
- This script IS the test specification
- Every scene must be reproducible via Playwright
- Screenshots must be captured at each wow moment
