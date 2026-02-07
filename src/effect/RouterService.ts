/**
 * Effect-based Smart Router.
 *
 * Pure functions wrapped in Effect — routing is a computation
 * that never fails (always produces a result). Skill loading
 * is handled in the service Layer with fallback defaults.
 */
import { Context, Effect, Layer, pipe } from "effect";
import * as fs from "fs";
import * as path from "path";
import type { RouterResult, WorkflowType, SkillCategory } from "./schemas";

// ── Service interface ──────────────────────────────────────

export class RouterService extends Context.Tag("RouterService")<
  RouterService,
  {
    /** Route a task description to a workflow type and skills. */
    readonly route: (description: string) => RouterResult;

    /** Get all available skill categories. */
    readonly getSkillCategories: () => ReadonlyArray<SkillCategory>;

    /** Suggest best agent type for a task description. */
    readonly suggestAgentType: (description: string) => string;
  }
>() {}

// ── Pure functions ─────────────────────────────────────────

const DEFAULT_SKILLS: SkillCategory[] = [
  {
    name: "Frontend Development",
    skills: ["React", "TypeScript", "UI/UX", "CSS"],
    direction: "Build user interfaces",
  },
  {
    name: "Backend Development",
    skills: ["API", "Database", "Server", "Auth"],
    direction: "Build services",
  },
  {
    name: "Testing",
    skills: ["Unit testing", "Integration testing", "E2E"],
    direction: "Ensure quality",
  },
  {
    name: "DevOps",
    skills: ["CI/CD", "Deployment", "Monitoring"],
    direction: "Automate operations",
  },
  {
    name: "Documentation",
    skills: ["Technical writing", "API docs"],
    direction: "Document systems",
  },
  {
    name: "Asset Generation",
    skills: ["Image generation", "Icons"],
    direction: "Create visual assets",
  },
];

/** Analyze the complexity of a task description. Score 1-10. */
export const analyzeComplexity = (
  description: string
): { complexity: number; reasoning: string } => {
  const lower = description.toLowerCase();
  let complexity = 1;
  const reasons: string[] = [];

  if (/and\s|also\s|then\s|after\s|before\s|plus\s/i.test(lower)) {
    complexity += 2;
    reasons.push("multi-step task");
  }
  if (/all\s|every\s|entire\s|full\s|complete\s|whole/i.test(lower)) {
    complexity += 2;
    reasons.push("broad scope");
  }
  if (/architect|design|system|infrastructure|pipeline/i.test(lower)) {
    complexity += 2;
    reasons.push("architectural scope");
  }
  if (/test|debug|fix|refactor|optimize/i.test(lower)) {
    complexity += 1;
    reasons.push("technical depth");
  }
  if (lower.split(/[,;]/).length > 2) {
    complexity += 1;
    reasons.push("multiple items listed");
  }

  return {
    complexity: Math.min(10, complexity),
    reasoning:
      reasons.length > 0
        ? `Complexity ${complexity}/10: ${reasons.join(", ")}`
        : "Simple, single-focus task",
  };
};

const scoreSkillCategories = (
  skills: SkillCategory[],
  description: string
): Array<{ category: string; score: number }> =>
  skills.map((skill) => {
    let score = 0;
    for (const s of skill.skills) {
      const keywords = s.toLowerCase().split(/\s+/);
      for (const kw of keywords) {
        if (kw.length > 3 && description.includes(kw)) {
          score += 1;
        }
      }
    }
    const catWords = skill.name.toLowerCase().split(/\s+/);
    for (const w of catWords) {
      if (w.length > 3 && description.includes(w)) {
        score += 2;
      }
    }
    return { category: skill.name, score };
  });

const routeWithSkills = (
  skills: SkillCategory[],
  description: string
): RouterResult => {
  const lower = description.toLowerCase();
  const scores = scoreSkillCategories(skills, lower);
  const { complexity, reasoning } = analyzeComplexity(lower);

  let recommended: WorkflowType;
  let estimatedAgents: number;

  if (complexity <= 2) {
    recommended = "simple";
    estimatedAgents = 1;
  } else if (complexity <= 5) {
    recommended = "complex";
    estimatedAgents = Math.min(
      2,
      scores.filter((s) => s.score > 0).length || 1
    );
  } else {
    recommended = "team";
    estimatedAgents = Math.min(
      4,
      scores.filter((s) => s.score > 0).length || 2
    );
  }

  const topSkills = scores
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.category);

  if (topSkills.length === 0) {
    topSkills.push("Frontend Development");
  }

  const confidence = Math.min(
    0.95,
    0.4 + scores.filter((s) => s.score > 0).length * 0.15
  );

  return {
    recommended,
    confidence,
    reasoning,
    suggestedSkills: topSkills,
    estimatedAgents,
  };
};

const suggestAgentTypeWithSkills = (description: string): string => {
  const lower = description.toLowerCase();
  const agentScores: Record<string, number> = {
    zai: 0,
    claude: 0,
    openai: 0,
    gemini: 0,
    huggingface: 0,
  };

  if (/architect|plan|design|structure|refactor|organiz/i.test(lower))
    agentScores.zai += 3;
  if (/code|implement|develop|build|create/i.test(lower))
    agentScores.zai += 2;
  if (/debug|fix|error|bug|issue|problem/i.test(lower))
    agentScores.claude += 3;
  if (/test|coverage|spec|assert|verify/i.test(lower))
    agentScores.claude += 2;
  if (/complex|analyz|reason|understand/i.test(lower))
    agentScores.claude += 2;
  if (/document|readme|guide|explain|describe/i.test(lower))
    agentScores.openai += 3;
  if (/api|endpoint|route|server/i.test(lower)) agentScores.openai += 2;
  if (/ui|ux|design|visual|style|css|layout/i.test(lower))
    agentScores.gemini += 3;
  if (/component|interface|page|view/i.test(lower))
    agentScores.gemini += 2;
  if (/image|asset|icon|logo|illustration|graphic/i.test(lower))
    agentScores.huggingface += 3;

  const sorted = Object.entries(agentScores).sort(([, a], [, b]) => b - a);
  return sorted[0][1] > 0 ? sorted[0][0] : "claude";
};

// ── Live Layer ─────────────────────────────────────────────

export const RouterServiceLive = (skillsPath?: string): Layer.Layer<RouterService> =>
  Layer.succeed(RouterService, {
    route: (() => {
      const skills = loadSkills(skillsPath);
      return (description: string) => routeWithSkills(skills, description);
    })(),
    getSkillCategories: (() => {
      const skills = loadSkills(skillsPath);
      return () => skills;
    })(),
    suggestAgentType: suggestAgentTypeWithSkills,
  });

function loadSkills(skillsPath?: string): SkillCategory[] {
  const defaultPath = path.join(__dirname, "..", "..", "agent-skills.json");
  const resolvedPath = skillsPath || defaultPath;
  try {
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    const data = JSON.parse(raw);
    return data.agentSkills?.categories || DEFAULT_SKILLS;
  } catch {
    return DEFAULT_SKILLS;
  }
}
