/**
 * Effect-based Agent Service.
 *
 * Replaces AgentOrchestrator with a pure Effect service.
 * Manages agent lifecycle: create, update, message, spawn,
 * assign tasks, and stop.
 *
 * Child process management uses Effect.tryPromise with typed
 * errors (AgentNotFoundError, AgentSpawnError, etc.).
 *
 * Note: Kernel management and Fly.io helpers (normalizeFlyAppName,
 * buildFlyAppName) are preserved as internal implementation details.
 */
import { Context, Effect, Layer, Option } from "effect";
import { v4 as uuidv4 } from "uuid";
import * as child_process from "child_process";
import type {
  Agent,
  AgentRuntime,
  AgentStatus,
  Message,
} from "./schemas";
import { ConfigService } from "./services";
import {
  AgentNotFoundError,
  AgentNoKernelError,
  AgentSpawnError,
  FileWriteError,
  JsonParseError,
} from "./errors";

// ── Constants ──────────────────────────────────────────────

const MAX_FLY_APP_NAME_LENGTH = 30;
const DEFAULT_FLY_APP_PREFIX = "createsuite-agent-ui";
const AGENT_ID_SUFFIX_LENGTH = 8;
const REMOTE_AGENT_PID = -1;

// ── Fly.io helpers ─────────────────────────────────────────

const normalizeFlyAppName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const buildFlyAppName = (
  agentName: string,
  agentId: string,
  prefix: string = DEFAULT_FLY_APP_PREFIX
): string => {
  const idSuffix = agentId.slice(0, AGENT_ID_SUFFIX_LENGTH);
  const normalizedPrefix = normalizeFlyAppName(prefix);
  const normalizedName = normalizeFlyAppName(agentName);
  const separatorCount =
    (normalizedPrefix ? 1 : 0) + (normalizedName ? 1 : 0);
  const available = Math.max(
    0,
    MAX_FLY_APP_NAME_LENGTH - idSuffix.length - separatorCount
  );
  const prefixLength = Math.min(normalizedPrefix.length, available);
  const remainingForName = available - prefixLength;
  const nameLength = Math.min(normalizedName.length, remainingForName);
  const prefixPart = normalizedPrefix.slice(0, prefixLength);
  const namePart = normalizedName.slice(0, nameLength);
  return [prefixPart, namePart, idSuffix].filter(Boolean).join("-");
};

// ── Service interface ──────────────────────────────────────

export class AgentService extends Context.Tag("AgentService")<
  AgentService,
  {
    readonly createAgent: (
      name: string,
      capabilities?: string[],
      options?: { runtime?: AgentRuntime; flyAppName?: string }
    ) => Effect.Effect<Agent, FileWriteError>;

    readonly getAgent: (
      agentId: string
    ) => Effect.Effect<Option.Option<Agent>, JsonParseError>;

    readonly updateAgent: (
      agentId: string,
      updates: Partial<Agent>
    ) => Effect.Effect<
      Agent,
      AgentNotFoundError | FileWriteError | JsonParseError
    >;

    readonly listAgents: () => Effect.Effect<
      ReadonlyArray<Agent>,
      JsonParseError
    >;

    readonly getIdleAgents: () => Effect.Effect<
      ReadonlyArray<Agent>,
      JsonParseError
    >;

    readonly sendMessage: (
      from: string,
      toAgentId: string,
      subject: string,
      body: string
    ) => Effect.Effect<
      void,
      AgentNotFoundError | FileWriteError | JsonParseError
    >;

    readonly getUnreadMessages: (
      agentId: string
    ) => Effect.Effect<
      ReadonlyArray<Message>,
      AgentNotFoundError | JsonParseError
    >;

    readonly markMessageRead: (
      agentId: string,
      messageId: string
    ) => Effect.Effect<
      void,
      AgentNotFoundError | FileWriteError | JsonParseError
    >;

    /** Spawn an OpenCode terminal for the agent. Returns the PID. */
    readonly spawnOpenCodeTerminal: (
      agentId: string,
      workspaceRoot: string,
      onComplete?: (code: number | null) => void
    ) => Effect.Effect<
      number,
      AgentNotFoundError | AgentSpawnError | FileWriteError | JsonParseError
    >;

    /** Assign a task to an agent and optionally spawn the terminal. */
    readonly assignTaskToAgent: (
      agentId: string,
      taskId: string,
      workspaceRoot: string
    ) => Effect.Effect<
      void,
      AgentNotFoundError | AgentSpawnError | FileWriteError | JsonParseError
    >;

    /** Stop an agent and clean up processes. */
    readonly stopAgent: (
      agentId: string
    ) => Effect.Effect<
      void,
      AgentNotFoundError | FileWriteError | JsonParseError
    >;
  }
>() {}

// ── Live implementation ────────────────────────────────────

export const AgentServiceLive = Layer.effect(
  AgentService,
  Effect.map(ConfigService, (config) => {
    // In-memory tracking for managed processes
    const managedProcesses = new Map<
      string,
      {
        proc: child_process.ChildProcess;
        onComplete?: (code: number | null) => void;
      }
    >();

    const requireAgent = (
      agentId: string
    ): Effect.Effect<Agent, AgentNotFoundError | JsonParseError> =>
      Effect.gen(function* () {
        const opt = yield* config.loadAgent(agentId);
        if (Option.isNone(opt)) {
          return yield* Effect.fail(new AgentNotFoundError({ agentId }));
        }
        return opt.value;
      });

    const saveUpdatedAgent = (
      agent: Agent,
      updates: Partial<Agent>
    ): Effect.Effect<Agent, FileWriteError> => {
      const updatedAgent = { ...agent, ...updates } as Agent;
      return Effect.gen(function* () {
        yield* config.saveAgent(updatedAgent);
        return updatedAgent;
      });
    };

    return {
      createAgent: (
        name: string,
        capabilities: string[] = ["general"],
        options: { runtime?: AgentRuntime; flyAppName?: string } = {}
      ) =>
        Effect.gen(function* () {
          const runtime = options.runtime ?? "local";
          const agentId = uuidv4();
          const flyAppName =
            runtime === "fly"
              ? options.flyAppName || buildFlyAppName(name, agentId)
              : undefined;

          const agent: Agent = {
            id: agentId,
            name,
            status: "idle",
            mailbox: [],
            capabilities,
            runtime,
            flyAppName,
            createdAt: new Date(),
          };

          yield* config.saveAgent(agent);
          return agent;
        }),

      getAgent: (agentId: string) => config.loadAgent(agentId),

      updateAgent: (agentId: string, updates: Partial<Agent>) =>
        Effect.gen(function* () {
          const agent = yield* requireAgent(agentId);
          return yield* saveUpdatedAgent(agent, updates);
        }),

      listAgents: () => config.listAgents(),

      getIdleAgents: () =>
        Effect.gen(function* () {
          const agents = yield* config.listAgents();
          return agents.filter((a) => a.status === "idle");
        }),

      sendMessage: (
        from: string,
        toAgentId: string,
        subject: string,
        body: string
      ) =>
        Effect.gen(function* () {
          const agent = yield* requireAgent(toAgentId);
          const message: Message = {
            id: uuidv4(),
            from,
            to: toAgentId,
            subject,
            body,
            timestamp: new Date(),
            read: false,
          };
          const updatedMailbox = [...agent.mailbox, message];
          yield* saveUpdatedAgent(agent, {
            mailbox: updatedMailbox,
          } as Partial<Agent>);
        }),

      getUnreadMessages: (agentId: string) =>
        Effect.gen(function* () {
          const agent = yield* requireAgent(agentId);
          return agent.mailbox.filter((m) => !m.read);
        }),

      markMessageRead: (agentId: string, messageId: string) =>
        Effect.gen(function* () {
          const agent = yield* requireAgent(agentId);
          const updatedMailbox = agent.mailbox.map((m) =>
            m.id === messageId ? { ...m, read: true } : m
          );
          yield* saveUpdatedAgent(agent, {
            mailbox: updatedMailbox,
          } as Partial<Agent>);
        }),

      spawnOpenCodeTerminal: (
        agentId: string,
        workspaceRoot: string,
        onComplete?: (code: number | null) => void
      ) =>
        Effect.gen(function* () {
          const agent = yield* requireAgent(agentId);

          // Fly agents are handled externally
          if (agent.runtime === "fly") {
            yield* saveUpdatedAgent(agent, { status: "working" });
            return REMOTE_AGENT_PID;
          }

          const sanitizedWorkspace = workspaceRoot.replace(
            /['"\\$`]/g,
            "\\$&"
          );
          const provider =
            process.env.OPENCODE_PROVIDER || "zai-coding-plan";
          const model = process.env.OPENCODE_MODEL || "glm-4.7";

          // Load task details if assigned
          let runCommand = "opencode";
          if (agent.currentTask) {
            const taskOpt = yield* config.loadTask(agent.currentTask);
            if (Option.isSome(taskOpt)) {
              const task = taskOpt.value;
              const promptText = `${task.title}\n\n${task.description}`;
              const escapedPrompt = promptText.replace(/'/g, "'\\''");
              runCommand = `opencode run '${escapedPrompt}'`;
            }
          }

          const script = `
#!/bin/bash
set -e
if ! command -v opencode &> /dev/null; then
  curl -fsSL https://opencode.ai/install | bash
  export PATH="$HOME/.opencode/bin:$PATH"
fi
cd "${sanitizedWorkspace}"
export OPENCODE_PROVIDER="${provider}"
export OPENCODE_MODEL="${model}"
${runCommand}
`;

          const child = child_process.spawn("bash", ["-c", script], {
            cwd: workspaceRoot,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...process.env,
              OPENCODE_PROVIDER: provider,
              OPENCODE_MODEL: model,
            },
          });

          const pid = child.pid || 0;
          if (!child.pid) {
            return yield* Effect.fail(
              new AgentSpawnError({
                agentId,
                message: "Failed to spawn child process",
              })
            );
          }

          managedProcesses.set(agentId, { proc: child, onComplete });

          child.stdout?.on("data", (data: Buffer) => {
            process.stdout.write(`[agent:${agent.name}] ${data.toString()}`);
          });
          child.stderr?.on("data", (data: Buffer) => {
            process.stderr.write(
              `[agent:${agent.name}:err] ${data.toString()}`
            );
          });

          child.on("exit", async (code) => {
            const newStatus: AgentStatus =
              code === 0 ? "idle" : "error";
            try {
              // Fire-and-forget status update
              const opt = await Effect.runPromise(
                config.loadAgent(agentId).pipe(
                  Effect.catchAll(() => Effect.succeed(Option.none<Agent>()))
                )
              );
              if (Option.isSome(opt)) {
                await Effect.runPromise(
                  config
                    .saveAgent({
                      ...opt.value,
                      status: newStatus,
                      terminalPid: undefined,
                    })
                    .pipe(Effect.catchAll(() => Effect.void))
                );
              }
            } catch {
              // Best-effort cleanup
            }

            managedProcesses.delete(agentId);
            if (onComplete) onComplete(code);
          });

          yield* saveUpdatedAgent(agent, {
            terminalPid: pid,
            status: "working",
          });

          return pid;
        }),

      assignTaskToAgent: (
        agentId: string,
        taskId: string,
        _workspaceRoot: string
      ) =>
        Effect.gen(function* () {
          const agent = yield* requireAgent(agentId);

          yield* saveUpdatedAgent(agent, {
            currentTask: taskId,
            status: "working",
          });

          // Send notification message
          const message: Message = {
            id: uuidv4(),
            from: "system",
            to: agentId,
            subject: "New Task Assignment",
            body: `You have been assigned task: ${taskId}`,
            timestamp: new Date(),
            read: false,
          };
          const freshAgent = yield* requireAgent(agentId);
          yield* saveUpdatedAgent(freshAgent, {
            mailbox: [...freshAgent.mailbox, message],
          } as Partial<Agent>);
        }),

      stopAgent: (agentId: string) =>
        Effect.gen(function* () {
          yield* requireAgent(agentId);

          // Kill managed process
          const managed = managedProcesses.get(agentId);
          if (managed && managed.proc) {
            try {
              managed.proc.kill("SIGTERM");
            } catch {
              // Process may already be dead
            }
            managedProcesses.delete(agentId);
          }

          // Reload and update
          const agent = yield* requireAgent(agentId);
          yield* saveUpdatedAgent(agent, {
            status: "offline",
            currentTask: undefined,
            terminalPid: undefined,
          });
        }),
    };
  })
);
