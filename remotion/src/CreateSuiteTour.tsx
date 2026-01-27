import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  random,
  Img,
  staticFile,
} from 'remotion';

// --- SASSY CONSTANTS ---

const COLORS = {
  hotPink: '#FF00CC',
  electricBlue: '#3333FF',
  neonGreen: '#00FF66',
  void: '#000000',
  pureWhite: '#FFFFFF',
  warning: '#FFCC00',
};

const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// --- ANIMATED BACKGROUND ---

const SassyBackground: React.FC<{
  primaryColor: string;
  secondaryColor: string;
}> = ({primaryColor, secondaryColor}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  // Create a moving gradient background
  const gradientOffset = (frame * 5) % (width * 2);
  
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})`,
        backgroundSize: '400% 400%',
        animation: 'gradient 15s ease infinite', // CSS animation simulation via manual updates if needed, but linear-gradient shift is easier
        transform: `translate(${-gradientOffset / 10}px, 0)`, // Subtle movement
        width: '150%', // clear edges
        height: '100%',
      }}
    >
       <AbsoluteFill style={{
         background: `radial-gradient(circle at center, transparent 0%, ${COLORS.void} 120%)`,
         opacity: 0.7
       }} />
    </AbsoluteFill>
  );
};

// --- COMPONENTS ---

const BigText: React.FC<{children: React.ReactNode; color?: string; delay?: number}> = ({children, color = COLORS.pureWhite, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  const enter = spring({
    frame: frame - delay,
    fps,
    config: {damping: 12, stiffness: 100},
  });

  const rotate = interpolate(enter, [0, 1], [10, 0]);
  const scale = interpolate(enter, [0, 1], [0.5, 1]);

  return (
    <h1
      style={{
        fontFamily: FONT_FAMILY,
        fontWeight: 900,
        fontSize: 140,
        color: color,
        textAlign: 'center',
        margin: 0,
        lineHeight: 0.9,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        textShadow: '10px 10px 0px rgba(0,0,0,0.5)',
        letterSpacing: '-5px',
        opacity: enter
      }}
    >
      {children}
    </h1>
  );
};

const SubText: React.FC<{children: React.ReactNode; delay?: number}> = ({children, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  const enter = spring({
    frame: frame - delay,
    fps,
    config: {damping: 20},
  });

  const y = interpolate(enter, [0, 1], [100, 0]);

  return (
    <p
      style={{
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        fontSize: 50,
        color: COLORS.pureWhite,
        textAlign: 'center',
        marginTop: 40,
        maxWidth: '80%',
        transform: `translateY(${y}px)`,
        opacity: enter,
        background: COLORS.void,
        padding: '10px 40px',
        borderRadius: 50,
        display: 'inline-block'
      }}
    >
      {children}
    </p>
  );
};

// --- SCENES ---

const TitleScene: React.FC = () => {
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <SassyBackground primaryColor={COLORS.hotPink} secondaryColor={COLORS.electricBlue} />
      <div style={{zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <BigText>CREATESUITE</BigText>
        <SubText delay={10}>Stop coding like it's 2015.</SubText>
      </div>
    </AbsoluteFill>
  );
};

const AgentsScene: React.FC = () => {
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <SassyBackground primaryColor={COLORS.neonGreen} secondaryColor={COLORS.void} />
      <div style={{zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
         <div style={{fontSize: 200, marginBottom: 20}}>🤖</div>
        <BigText color={COLORS.neonGreen}>ACTUAL<br/>WORKERS</BigText>
        <SubText delay={15}>Unlike your last intern, these agents handle their own state.</SubText>
      </div>
    </AbsoluteFill>
  );
};

const GitScene: React.FC = () => {
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <SassyBackground primaryColor={COLORS.electricBlue} secondaryColor={COLORS.hotPink} />
      <div style={{zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{fontSize: 200, marginBottom: 20}}>🔥</div>
        <BigText color={COLORS.warning}>GIT-BACKED<br/>DRAMA</BigText>
        <SubText delay={15}>Everything is tracked. We saw what you broke.</SubText>
      </div>
    </AbsoluteFill>
  );
};

const ConvoyScene: React.FC = () => {
    const frame = useCurrentFrame();
    const rotate = frame * 2;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <SassyBackground primaryColor={COLORS.pureWhite} secondaryColor={COLORS.void} />
       <div style={{
           position: 'absolute', 
           width: 1000, 
           height: 1000, 
           border: `20px solid ${COLORS.hotPink}`, 
           borderRadius: '50%',
           transform: `rotate(${rotate}deg)`,
           opacity: 0.2
       }} />
      <div style={{zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <BigText color={COLORS.hotPink}>CONVOYS</BigText>
        <SubText delay={15}>Squad goals for your codebase.</SubText>
      </div>
    </AbsoluteFill>
  );
};

const CLIScene: React.FC = () => {
    const frame = useCurrentFrame();
    const lines = [
        "> cs init --fancy",
        "> cs agent hire --sassy",
        "> cs convoy dispatch",
        "> ...profit?"
    ];

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.void, padding: 100, fontFamily: 'monospace'}}>
      <h2 style={{color: COLORS.neonGreen, fontSize: 80, margin: 0, marginBottom: 60}}>THE CLI:</h2>
      {lines.map((line, i) => {
          const delay = i * 20;
          const show = frame > delay;
          return (
              <div key={i} style={{
                  color: COLORS.pureWhite, 
                  fontSize: 60, 
                  marginBottom: 30,
                  opacity: show ? 1 : 0,
                  transform: `translateX(${show ? 0 : -50}px)`,
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}>
                  {line}
              </div>
          )
      })}
    </AbsoluteFill>
  );
};

const CTAScene: React.FC = () => {
    const frame = useCurrentFrame();
    const {fps} = useVideoConfig();
    const scale = spring({frame, fps, config: {stiffness: 200, damping: 10}});

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.hotPink}}>
      <div style={{transform: `scale(${scale})`, textAlign: 'center'}}>
        <BigText color={COLORS.pureWhite}>INSTALL IT.</BigText>
        <div style={{
            marginTop: 60,
            background: COLORS.void,
            color: COLORS.neonGreen,
            padding: '30px 80px',
            fontSize: 60,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            borderRadius: 20,
            boxShadow: '20px 20px 0px rgba(0,0,0,0.3)'
        }}>
            npm install createsuite
        </div>
        <p style={{color: COLORS.pureWhite, fontSize: 30, marginTop: 40, fontWeight: 'bold'}}>
            Do it. I'll wait.
        </p>
      </div>
    </AbsoluteFill>
  );
};

// --- MAIN COMPOSITION ---

const SCENE_DURATION = 90; // 3 seconds - keep it snappy!

export const CreateSuiteTour: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.void}}>
      <Sequence from={0} durationInFrames={SCENE_DURATION}>
        <TitleScene />
      </Sequence>
      
      <Sequence from={SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <AgentsScene />
      </Sequence>
      
      <Sequence from={SCENE_DURATION * 2} durationInFrames={SCENE_DURATION}>
        <GitScene />
      </Sequence>
      
      <Sequence from={SCENE_DURATION * 3} durationInFrames={SCENE_DURATION}>
        <ConvoyScene />
      </Sequence>

       <Sequence from={SCENE_DURATION * 4} durationInFrames={SCENE_DURATION}>
        <CLIScene />
      </Sequence>

      <Sequence from={SCENE_DURATION * 5} durationInFrames={SCENE_DURATION}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};