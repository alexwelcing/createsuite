import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

// Container — all layers stack inside this
const BackgroundContainer = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
`;

// CSS gradient fallback (shown until WebGL loads, then fades out)
const GradientFallback = styled.div<{ $hidden: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  opacity: ${props => props.$hidden ? 0 : 1};
  transition: opacity 2s ease-in-out;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 107, 107, 0.2) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(78, 205, 196, 0.15) 0%, transparent 50%);
  }
`;

// The library mounts its own canvas inside this div
const ViewerMount = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;

  /* The library appends a <canvas>; make it fill the container */
  canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
`;

// Vignette overlay
const VignetteOverlay = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.4) 100%);
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 2s ease-in-out;
`;

// Simple WebGL2 check (the library needs WebGL2)
const hasWebGL2 = (): boolean => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2'));
  } catch {
    return false;
  }
};

const GaussianBackground: React.FC<{ className?: string }> = ({ className }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!mountRef.current || !hasWebGL2()) {
      setFailed(true);
      return;
    }

    let disposed = false;
    const el = mountRef.current;

    (async () => {
      try {
        // Dynamic import — code-split the heavy libs
        const gs = await import('@mkkellogg/gaussian-splats-3d');
        if (disposed) return;

        const viewer = new gs.Viewer({
          rootElement: el,
          selfDrivenMode: true,
          initialCameraPosition: [0, 2, 6],
          initialCameraLookAt: [0, 0, 0],
          logLevel: gs.LogLevel.None,
          dynamicScene: false,
          useBuiltInControls: false,
          ignoreDevicePixelRatio: false,
        });
        viewerRef.current = viewer;

        // Try .spz first, fall back to .ply
        const urls = ['/splats/rustic-library.spz', '/splats/default.ply'];
        let ok = false;
        for (const url of urls) {
          try {
            await viewer.addSplatScene(url, {
              showLoadingUI: false,
              splatAlphaRemovalThreshold: 5,
            });
            ok = true;
            break;
          } catch (e) {
            console.warn(`[GaussianBg] Failed to load ${url}:`, e);
          }
        }

        if (disposed) { try { viewer.dispose(); } catch {} return; }

        if (ok) {
          setLoaded(true);
        } else {
          setFailed(true);
        }
      } catch (err) {
        console.error('[GaussianBg] Init failed:', err);
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      if (viewerRef.current) {
        try { viewerRef.current.dispose(); } catch {}
        viewerRef.current = null;
      }
      // Clean up any canvas the library injected
      while (el.firstChild) el.removeChild(el.firstChild);
    };
  }, []);

  return (
    <BackgroundContainer className={className}>
      <GradientFallback $hidden={loaded && !failed} />
      {!failed && <ViewerMount ref={mountRef} />}
      <VignetteOverlay $visible={loaded && !failed} />
    </BackgroundContainer>
  );
};

export default GaussianBackground;