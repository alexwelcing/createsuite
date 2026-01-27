import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion';

const colors = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  accent: '#10b981',
  dark: '#1e293b',
  light: '#f8fafc',
};

// Timing constants (in frames at 30 FPS)
const SCENE_DURATION = 150; // 5 seconds per scene
const TIMING = {
  title: {start: 0, duration: SCENE_DURATION},
  agents: {start: 150, duration: SCENE_DURATION},
  git: {start: 300, duration: SCENE_DURATION},
  convoy: {start: 450, duration: SCENE_DURATION},
  cli: {start: 600, duration: SCENE_DURATION},
  cta: {start: 750, duration: SCENE_DURATION},
};

// Title scene component
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {damping: 100, stiffness: 200, mass: 0.5},
  });

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.dark,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 120,
            fontWeight: 'bold',
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 20,
          }}
        >
          CreateSuite
        </h1>
        <p
          style={{
            fontSize: 40,
            color: colors.light,
            opacity: 0.9,
          }}
        >
          Orchestrated Swarm System for OpenCode Agents
        </p>
      </div>
    </AbsoluteFill>
  );
};

// Feature scene component
const FeatureScene: React.FC<{
  title: string;
  description: string;
  icon: string;
}> = ({title, description, icon}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const slideIn = spring({
    frame,
    fps,
    config: {damping: 100},
  });

  const translateX = interpolate(slideIn, [0, 1], [-100, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.dark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          maxWidth: 1200,
        }}
      >
        <div
          style={{
            fontSize: 100,
            marginBottom: 40,
          }}
        >
          {icon}
        </div>
        <h2
          style={{
            fontSize: 80,
            color: colors.primary,
            marginBottom: 30,
            fontWeight: 'bold',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: 40,
            color: colors.light,
            lineHeight: 1.6,
            opacity: 0.9,
          }}
        >
          {description}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// CLI Demo scene
const CLIScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const commands = [
    'cs init --name my-project --git',
    'cs agent create alice --capabilities "frontend,testing"',
    'cs task create --title "Build feature" --priority high',
    'cs agent assign cs-abc12 alice',
  ];

  const commandOpacity = (index: number) => {
    const startFrame = index * 30;
    return interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    });
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.dark,
        padding: 100,
        justifyContent: 'center',
      }}
    >
      <div style={{maxWidth: 1200}}>
        <h2
          style={{
            fontSize: 70,
            color: colors.primary,
            marginBottom: 50,
            fontWeight: 'bold',
          }}
        >
          Simple CLI Interface
        </h2>
        <div
          style={{
            backgroundColor: '#0f172a',
            padding: 40,
            borderRadius: 20,
            fontFamily: 'monospace',
          }}
        >
          {commands.map((cmd, i) => (
            <div
              key={i}
              style={{
                fontSize: 32,
                color: colors.accent,
                marginBottom: 20,
                opacity: commandOpacity(i),
              }}
            >
              <span style={{color: colors.secondary}}>$</span> {cmd}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Architecture scene
const ArchitectureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const components = [
    {name: 'Agents', desc: 'Autonomous workers'},
    {name: 'Tasks', desc: 'Git-backed work items'},
    {name: 'Convoys', desc: 'Task groups'},
    {name: 'Mailbox', desc: 'Communication'},
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.dark,
        padding: 100,
        justifyContent: 'center',
      }}
    >
      <div style={{opacity: fadeIn}}>
        <h2
          style={{
            fontSize: 70,
            color: colors.primary,
            marginBottom: 50,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          Powerful Architecture
        </h2>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: 40,
          }}
        >
          {components.map((comp, i) => {
            const compOpacity = interpolate(frame, [i * 15, i * 15 + 20], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });

            return (
              <div
                key={i}
                style={{
                  backgroundColor: '#1e40af',
                  padding: 40,
                  borderRadius: 20,
                  width: 300,
                  opacity: compOpacity,
                }}
              >
                <h3
                  style={{
                    fontSize: 45,
                    color: colors.light,
                    marginBottom: 15,
                    fontWeight: 'bold',
                  }}
                >
                  {comp.name}
                </h3>
                <p
                  style={{
                    fontSize: 28,
                    color: colors.light,
                    opacity: 0.8,
                  }}
                >
                  {comp.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Final CTA scene
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const scale = spring({
    frame: frame - 20,
    fps,
    config: {damping: 100, stiffness: 150},
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.dark,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          transform: `scale(${scale})`,
        }}
      >
        <h2
          style={{
            fontSize: 90,
            color: colors.primary,
            marginBottom: 40,
            fontWeight: 'bold',
          }}
        >
          Get Started Today
        </h2>
        <div
          style={{
            fontSize: 45,
            color: colors.light,
            backgroundColor: colors.primary,
            padding: '30px 60px',
            borderRadius: 15,
            display: 'inline-block',
            fontWeight: 'bold',
          }}
        >
          npm install createsuite
        </div>
        <p
          style={{
            fontSize: 35,
            color: colors.light,
            marginTop: 40,
            opacity: 0.8,
          }}
        >
          Orchestrate Your Agents with Confidence
        </p>
      </div>
    </AbsoluteFill>
  );
};

// Main composition
export const CreateSuiteTour: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={TIMING.title.start} durationInFrames={TIMING.title.duration}>
        <TitleScene />
      </Sequence>

      <Sequence from={TIMING.agents.start} durationInFrames={TIMING.agents.duration}>
        <FeatureScene
          title="First-Class Agents"
          description="Autonomous agents running in dedicated OpenCode terminals with their own identity, state, and communication channels."
          icon="🤖"
        />
      </Sequence>

      <Sequence from={TIMING.git.start} durationInFrames={TIMING.git.duration}>
        <FeatureScene
          title="Git-Based Tracking"
          description="Persistent task state using git-backed storage. Every change is tracked, versioned, and auditable."
          icon="📋"
        />
      </Sequence>

      <Sequence from={TIMING.convoy.start} durationInFrames={TIMING.convoy.duration}>
        <FeatureScene
          title="Convoy Orchestration"
          description="Organize related tasks into convoys for coordinated multi-agent workflows and progress tracking."
          icon="🚚"
        />
      </Sequence>

      <Sequence from={TIMING.cli.start} durationInFrames={TIMING.cli.duration}>
        <CLIScene />
      </Sequence>

      <Sequence from={TIMING.cta.start} durationInFrames={TIMING.cta.duration}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
