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

/**
 * Build the full application layer from a workspace root path.
 *
 * The dependency graph is:
 *
 *   WorkspaceRoot
 *       └─ ConfigService
 *            ├─ TaskService
 *            │    └─ ConvoyService
 *            └─ (future: AgentService, etc.)
 *   RouterService (standalone, no deps)
 */
export const AppLayer = (
  workspaceRoot: string
): Layer.Layer<
  WorkspaceRoot | ConfigService | TaskService | ConvoyService | RouterService
> => {
  const wsLayer = WorkspaceRootLive(workspaceRoot);
  const configLayer = Layer.provide(ConfigServiceLive, wsLayer);
  const taskLayer = Layer.provide(TaskServiceLive, configLayer);
  const convoyLayer = Layer.provide(
    ConvoyServiceLive,
    Layer.merge(configLayer, taskLayer)
  );
  const routerLayer = RouterServiceLive();

  return Layer.mergeAll(
    wsLayer,
    configLayer,
    taskLayer,
    convoyLayer,
    routerLayer
  );
};
