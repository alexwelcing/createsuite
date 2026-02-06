declare module '@mkkellogg/gaussian-splats-3d' {
  export class Viewer {
    static WebXRMode: {
      None: number;
      VR: number;
      AR: number;
    };

    camera: {
      position: { set(x: number, y: number, z: number): void };
      lookAt(x: number, y: number, z: number): void;
      updateMatrixWorld(): void;
    };

    constructor(options?: {
      canvas?: HTMLCanvasElement;
      selfDrivenMode?: boolean;
      webXRMode?: number;
      initialCameraPosition?: [number, number, number];
      initialCameraLookAt?: [number, number, number];
      logLevel?: number;
      [key: string]: unknown;
    });

    addSplatScene(
      url: string,
      options?: {
        format?: number;
        splatAlphaRemovalThreshold?: number;
        showLoadingUI?: boolean;
        [key: string]: unknown;
      }
    ): Promise<void>;

    setRenderDimensions(width: number, height: number): void;
    update(): void;
    dispose(): void;
  }

  export const SceneFormat: {
    Splat: number;
    Ply: number;
    KSplat: number;
  };

  export const LogLevel: {
    None: number;
    Silent: number;
    Info: number;
    Debug: number;
  };
}
