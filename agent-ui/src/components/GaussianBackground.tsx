import React, { useEffect, useRef, useState, useCallback } from 'react';
import styled from 'styled-components';

// Dynamic import for code-splitting (Three.js + gaussian-splats-3d are ~1.5MB)
type GaussianModule = typeof import('@mkkellogg/gaussian-splats-3d');
let gaussianModule: GaussianModule | null = null;
const loadGaussianModule = async (): Promise<GaussianModule> => {
  if (!gaussianModule) {
    gaussianModule = await import('@mkkellogg/gaussian-splats-3d');
  }
  return gaussianModule;
};

// Container with fallback gradient
const BackgroundContainer = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
`;

// CSS gradient fallback (shown until WebGL loads)
const GradientFallback = styled.div<{ $hidden: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  opacity: ${props => props.$hidden ? 0 : 1};
  transition: opacity 1.5s ease-in-out;
  
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

// Canvas container for Three.js
const CanvasContainer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
`;

// Vignette overlay for visual polish
const VignetteOverlay = styled.div<{ $loading: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%);
  opacity: ${props => props.$loading ? 0 : 1};
  transition: opacity 2s ease-in-out;
`;

// Loading indicator
const LoadingOverlay = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(10px);
  color: white;
  font-family: system-ui, -apple-system, sans-serif;
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 1s ease-in-out;
  pointer-events: none;
`;

interface GaussianBackgroundProps {
  className?: string;
}

// WebGL capability detection
const detectWebGL = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
};

// Performance quality detection
const detectPerformanceLevel = (): 'high' | 'medium' | 'low' => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  
  if (!gl) return 'low';
  
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
    
    // Check for dedicated GPUs
    if (renderer.includes('nvidia') || renderer.includes('amd') || renderer.includes('radeon')) {
      return 'high';
    }
    
    // Check for integrated but decent GPUs
    if (renderer.includes('intel') && (renderer.includes('iris') || renderer.includes('uhd'))) {
      return 'medium';
    }
  }
  
  return 'low';
};

const GaussianBackground: React.FC<GaussianBackgroundProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0, y: 0 });
  const currentRotationRef = useRef({ x: 0, y: 0 });
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Default splat file URLs (trying multiple sources)
  const splatUrls = [
    '/splats/rustic-library.spz', // Primary: Rustic Library Living Room
    '/splats/default.ply' // Procedural fallback
  ];
  
  // Mouse movement handler for parallax effect
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Normalize mouse position to -1 to 1 range
    const mouseX = (event.clientX - rect.left - centerX) / centerX;
    const mouseY = (event.clientY - rect.top - centerY) / centerY;
    
    // Apply subtle parallax effect (scale down the movement)
    targetRotationRef.current = {
      x: mouseY * 0.05, // Vertical rotation
      y: mouseX * 0.05  // Horizontal rotation
    };
    
    mouseRef.current = { x: mouseX, y: mouseY };
  }, []);

  // Animation loop for smooth camera movement
  const animate = useCallback(() => {
    if (!viewerRef.current || loadError) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    try {
      // Smooth camera interpolation
      const lerpFactor = 0.05; // Smooth interpolation
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * lerpFactor;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * lerpFactor;

      // Update camera rotation for subtle parallax
      const camera = viewerRef.current.camera;
      if (camera) {
        // Apply subtle orbital rotation
        const baseRadius = 5;
        const x = Math.cos(currentRotationRef.current.y) * Math.cos(currentRotationRef.current.x) * baseRadius;
        const y = Math.sin(currentRotationRef.current.x) * baseRadius;
        const z = Math.sin(currentRotationRef.current.y) * Math.cos(currentRotationRef.current.x) * baseRadius;
        
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
      }

      // Render the scene
      viewerRef.current.update();
    } catch (error) {
      console.warn('Animation error:', error);
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [loadError]);

  // Initialize Gaussian Splatting viewer
  const initializeViewer = useCallback(async () => {
    if (!containerRef.current || !hasWebGL) return;
    
    try {
      setIsLoading(true);
      setLoadError(false);

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvasRef.current = canvas;
      
      // Append canvas to container
      containerRef.current.appendChild(canvas);

      // Detect performance level and adjust settings
      const performanceLevel = detectPerformanceLevel();
      const pixelRatio = Math.min(window.devicePixelRatio, performanceLevel === 'high' ? 2 : 1);
      
      // Dynamically load the gaussian-splats-3d library (code-split)
      const { Viewer, SceneFormat: SF, LogLevel: LL } = await loadGaussianModule();

      // Initialize Gaussian Splats viewer
      const viewer = new Viewer({
        canvas: canvas,
        // Adjust quality settings based on performance
        selfDrivenMode: false,
        webXRMode: Viewer.WebXRMode.None,
        // Set initial camera position
        initialCameraPosition: [5, 2, 5],
        initialCameraLookAt: [0, 0, 0],
        // Performance optimizations
        logLevel: LL.Silent,
      });

      viewerRef.current = viewer;

      // Set canvas size
      const resizeCanvas = () => {
        if (!containerRef.current || !canvas) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = rect.width * pixelRatio;
        canvas.height = rect.height * pixelRatio;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        if (viewer) {
          viewer.setRenderDimensions(canvas.width, canvas.height);
        }
      };

      // Initial resize
      resizeCanvas();
      
      // Handle window resize
      const handleResize = () => resizeCanvas();
      window.addEventListener('resize', handleResize);

      // Load the splat scene with fallbacks
      let sceneLoaded = false;
      
      for (const url of splatUrls) {
        try {
          const format = url.endsWith('.spz') ? SF.Spz
            : url.endsWith('.ply') ? SF.Ply
            : url.endsWith('.ksplat') ? SF.KSplat
            : SF.Splat;
          await viewer.addSplatScene(url, {
            format,
            splatAlphaRemovalThreshold: 10,
            showLoadingUI: false,
          });
          
          sceneLoaded = true;
          break; // Successfully loaded
        } catch (loadErr) {
          console.warn(`Failed to load splat scene from ${url}:`, loadErr);
          continue; // Try next URL
        }
      }

      if (!sceneLoaded) {
        // Create a procedural splat scene as final fallback
        const fallbackScene = createFallbackScene();
        if (fallbackScene) {
          await viewer.addSplatScene(fallbackScene, {
            showLoadingUI: false,
          });
          sceneLoaded = true;
        }
      }

      if (sceneLoaded) {
        // Scene loaded successfully
        setIsLoading(false);
        
        // Start animation loop
        animate();
      } else {
        // No scenes loaded, fall back to CSS gradient
        console.warn('No Gaussian splat scenes could be loaded, falling back to CSS background');
        setLoadError(true);
        setIsLoading(false);
        setHasWebGL(false);
      }

      return () => {
        window.removeEventListener('resize', handleResize);
      };

    } catch (error) {
      console.error('Failed to initialize Gaussian Splatting viewer:', error);
      setLoadError(true);
      setIsLoading(false);
      setHasWebGL(false);
    }
  }, [hasWebGL, animate]);

  // Create procedural fallback scene
  const createFallbackScene = useCallback(() => {
    // This would create a simple procedural gaussian splat scene
    // For now, we'll return null and rely on CSS fallback
    return null;
  }, []);

  // Initialize on mount
  useEffect(() => {
    // Check WebGL support
    const webglSupported = detectWebGL();
    setHasWebGL(webglSupported);
    
    if (webglSupported) {
      initializeViewer();
    } else {
      setIsLoading(false);
      console.warn('WebGL not supported, using CSS gradient fallback');
    }

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (viewerRef.current) {
        try {
          viewerRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing viewer:', e);
        }
      }
      
      if (canvasRef.current && containerRef.current && containerRef.current.contains(canvasRef.current)) {
        containerRef.current.removeChild(canvasRef.current);
      }
    };
  }, [initializeViewer]);

  // Add mouse move listeners
  useEffect(() => {
    if (!hasWebGL || loadError) return;
    
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [hasWebGL, loadError, handleMouseMove]);

  return (
    <BackgroundContainer className={className}>
      {/* CSS gradient fallback — fades out when WebGL scene loads */}
      <GradientFallback $hidden={hasWebGL && !isLoading && !loadError} />

      {/* WebGL Canvas Container */}
      {hasWebGL && !loadError && (
        <CanvasContainer ref={containerRef} />
      )}
      
      {/* Loading overlay */}
      {hasWebGL && !loadError && (
        <LoadingOverlay $visible={isLoading}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', fontSize: '14px', opacity: 0.8 }}>
              Loading immersive background...
            </div>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }} />
          </div>
        </LoadingOverlay>
      )}
      
      {/* Vignette overlay for visual polish */}
      {hasWebGL && !loadError && (
        <VignetteOverlay $loading={isLoading} />
      )}
      
      {/* CSS animation keyframes */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </BackgroundContainer>
  );
};

export default GaussianBackground;