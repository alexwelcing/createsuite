/**
 * Composed Layers for CreateSuite.
 *
 * AppLayer is the single "provide" that wires up the entire
 * service graph. Consumers call:
 *
 *   Effect.runPromise(
 *     myProgram.pipe(Effect.provide(AppLayer(cwd)))
 *   )
 */
import { Layer } from "effect";
import {
  WorkspaceRoot,
  WorkspaceRootLive,
  ConfigService,
  ConfigServiceLive,
} from "./services";
import { TaskService, TaskServiceLive } from "./TaskService";
import { ConvoyService, ConvoyServiceLive } from "./ConvoyService";
import { RouterService, RouterServiceLive } from "./RouterService";
import { GitService, GitServiceLive } from "./GitService";
import { PRService, PRServiceLive } from "./PRService";
import { AgentService, AgentServiceLive } from "./AgentService";
import { PlanService, PlanServiceLive } from "./PlanService";
import { PipelineService, PipelineServiceLive } from "./PipelineService";

/**
 * Build the full application layer from a workspace root path.
 *
 * The dependency graph is:
 *
 *   WorkspaceRoot
 *       └─ ConfigService
 *            ├─ TaskService
 *            │    └─ ConvoyService
 *            ├─ AgentService
 *            └─ GitService
 *   RouterService (standalone)
 *   PRService (standalone, needs GITHUB_TOKEN)
 *   PlanService (depends on Task, Convoy, Router, Agent)
 *   PipelineService (depends on all)
 */
export const AppLayer = (
  workspaceRoot: string,
  options?: { githubToken?: string }
): Layer.Layer<
  | WorkspaceRoot
  | ConfigService
  | TaskService
  | ConvoyService
  | RouterService
  | GitService
  | PRService
  | AgentService
  | PlanService
  | PipelineService
> => {
  const wsLayer = WorkspaceRootLive(workspaceRoot);
  const configLayer = Layer.provide(ConfigServiceLive, wsLayer);
  const taskLayer = Layer.provide(TaskServiceLive, configLayer);
  const convoyLayer = Layer.provide(
    ConvoyServiceLive,
    Layer.merge(configLayer, taskLayer)
  );
  const routerLayer = RouterServiceLive();
  const gitLayer = Layer.provide(GitServiceLive, wsLayer);
  const prLayer = PRServiceLive(options?.githubToken);
  const agentLayer = Layer.provide(AgentServiceLive, configLayer);

  // PlanService depends on WS + Task + Convoy + Router + Agent
  const planDeps = Layer.mergeAll(
    wsLayer,
    taskLayer,
    convoyLayer,
    routerLayer,
    agentLayer
  );
  const planLayer = Layer.provide(PlanServiceLive, planDeps);

  // PipelineService depends on WS + Task + Convoy + Agent + Git + PR + Plan
  const pipelineDeps = Layer.mergeAll(
    wsLayer,
    taskLayer,
    convoyLayer,
    agentLayer,
    gitLayer,
    prLayer,
    planLayer
  );
  const pipelineLayer = Layer.provide(PipelineServiceLive, pipelineDeps);

  return Layer.mergeAll(
    wsLayer,
    configLayer,
    taskLayer,
    convoyLayer,
    routerLayer,
    gitLayer,
    prLayer,
    agentLayer,
    planLayer,
    pipelineLayer
  );
};
