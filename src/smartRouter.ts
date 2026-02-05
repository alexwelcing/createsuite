import * as fs from 'fs';
import * as path from 'path';
import { RouterResult, WorkflowType, SkillCategory } from './types';

/**
 * SmartRouter — analyzes task descriptions and routes them
 * to the appropriate workflow type and skill categories.
 *
 * This is used by the CLI when creating tasks to suggest
 * the right agent capabilities, and by PlanManager to
 * decompose goals into skill-matched subtasks.
 */
export class SmartRouter {
  private skills: SkillCategory[];

  constructor(skillsPath?: string) {
    const defaultPath = path.join(__dirname, '..', 'agent-skills.json');
    const resolvedPath = skillsPath || defaultPath;
    try {
      const raw = fs.readFileSync(resolvedPath, 'utf-8');
      const data = JSON.parse(raw);
      this.skills = data.agentSkills?.categories || [];
    } catch {
      // Fallback built-in skills if file not found
      this.skills = SmartRouter.DEFAULT_SKILLS;
    }
  }

  /**
   * Route a task description to a workflow type and matching skills.
   */
  route(description: string): RouterResult {
    const lower = description.toLowerCase();
    const scores = this.scoreSkillCategories(lower);
    const { complexity, reasoning } = analyzeComplexity(lower);

    // Determine workflow type based on complexity
    let recommended: WorkflowType;
    let estimatedAgents: number;

    if (complexity <= 2) {
      recommended = 'simple';
      estimatedAgents = 1;
    } else if (complexity <= 5) {
      recommended = 'complex';
      estimatedAgents = Math.min(2, scores.filter(s => s.score > 0).length || 1);
    } else {
      recommended = 'team';
      estimatedAgents = Math.min(4, scores.filter(s => s.score > 0).length || 2);
    }

    // Pick top matching skills
    const topSkills = scores
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.category);

    // If no skills matched, default to general
    if (topSkills.length === 0) {
      topSkills.push('Frontend Development');
    }

    const confidence = Math.min(
      0.95,
      0.4 + (scores.filter(s => s.score > 0).length * 0.15)
    );

    return {
      recommended,
      confidence,
      reasoning,
      suggestedSkills: topSkills,
      estimatedAgents
    };
  }

  /**
   * Get all available skill categories.
   */
  getSkillCategories(): SkillCategory[] {
    return this.skills;
  }

  /**
   * Match a task to the best agent type from AGENT_CONFIGS.
   * Returns agent type keys like 'claude', 'zai', 'openai', etc.
   */
  suggestAgentType(description: string): string {
    const lower = description.toLowerCase();

    // Keyword-based agent type matching
    const agentScores: Record<string, number> = {
      zai: 0,
      claude: 0,
      openai: 0,
      gemini: 0,
      huggingface: 0
    };

    // Z.ai GLM — architecture, planning, code structure
    if (/architect|plan|design|structure|refactor|organiz/i.test(lower)) agentScores.zai += 3;
    if (/code|implement|develop|build|create/i.test(lower)) agentScores.zai += 2;

    // Claude — complex reasoning, testing, debugging
    if (/debug|fix|error|bug|issue|problem/i.test(lower)) agentScores.claude += 3;
    if (/test|coverage|spec|assert|verify/i.test(lower)) agentScores.claude += 2;
    if (/complex|analyz|reason|understand/i.test(lower)) agentScores.claude += 2;

    // OpenAI — general purpose, documentation
    if (/document|readme|guide|explain|describe/i.test(lower)) agentScores.openai += 3;
    if (/api|endpoint|route|server/i.test(lower)) agentScores.openai += 2;

    // Gemini — UI/UX, multimodal
    if (/ui|ux|design|visual|style|css|layout/i.test(lower)) agentScores.gemini += 3;
    if (/component|interface|page|view/i.test(lower)) agentScores.gemini += 2;

    // Hugging Face — assets, images
    if (/image|asset|icon|logo|illustration|graphic/i.test(lower)) agentScores.huggingface += 3;

    // Find highest scoring agent
    const sorted = Object.entries(agentScores).sort(([, a], [, b]) => b - a);
    return sorted[0][1] > 0 ? sorted[0][0] : 'zai'; // Default to Z.ai
  }

  // -- Private --

  private scoreSkillCategories(description: string): Array<{ category: string; score: number }> {
    return this.skills.map(skill => {
      let score = 0;

      // Check skill keywords against description
      for (const s of skill.skills) {
        const keywords = s.toLowerCase().split(/\s+/);
        for (const kw of keywords) {
          if (kw.length > 3 && description.includes(kw)) {
            score += 1;
          }
        }
      }

      // Check category name
      const catWords = skill.name.toLowerCase().split(/\s+/);
      for (const w of catWords) {
        if (w.length > 3 && description.includes(w)) {
          score += 2;
        }
      }

      return { category: skill.name, score };
    });
  }

  static DEFAULT_SKILLS: SkillCategory[] = [
    { name: 'Frontend Development', skills: ['React', 'TypeScript', 'UI/UX', 'CSS'], direction: 'Build user interfaces' },
    { name: 'Backend Development', skills: ['API', 'Database', 'Server', 'Auth'], direction: 'Build services' },
    { name: 'Testing', skills: ['Unit testing', 'Integration testing', 'E2E'], direction: 'Ensure quality' },
    { name: 'DevOps', skills: ['CI/CD', 'Deployment', 'Monitoring'], direction: 'Automate operations' },
    { name: 'Documentation', skills: ['Technical writing', 'API docs'], direction: 'Document systems' },
    { name: 'Asset Generation', skills: ['Image generation', 'Icons'], direction: 'Create visual assets' }
  ];
}

/**
 * Analyze the complexity of a task description.
 * Returns a score from 1-10 and reasoning.
 */
export function analyzeComplexity(description: string): { complexity: number; reasoning: string } {
  const lower = description.toLowerCase();
  let complexity = 1;
  const reasons: string[] = [];

  // Multi-step indicators
  if (/and\s|also\s|then\s|after\s|before\s|plus\s/i.test(lower)) {
    complexity += 2;
    reasons.push('multi-step task');
  }

  // Scope indicators
  if (/all\s|every\s|entire\s|full\s|complete\s|whole/i.test(lower)) {
    complexity += 2;
    reasons.push('broad scope');
  }

  // Technical depth
  if (/refactor|migrate|restructure|rewrite|overhaul/i.test(lower)) {
    complexity += 2;
    reasons.push('structural changes');
  }

  // Cross-cutting concerns
  if (/security|performance|accessibility|internationali/i.test(lower)) {
    complexity += 1;
    reasons.push('cross-cutting concern');
  }

  // Testing requirements
  if (/test|coverage|spec/i.test(lower)) {
    complexity += 1;
    reasons.push('includes testing');
  }

  // Simple task indicators (reduce complexity)
  if (/fix typo|update readme|bump version|rename|add comment/i.test(lower)) {
    complexity = Math.max(1, complexity - 2);
    reasons.push('simple change');
  }

  complexity = Math.min(10, Math.max(1, complexity));
  const reasoning = reasons.length > 0
    ? `Complexity ${complexity}/10: ${reasons.join(', ')}`
    : `Complexity ${complexity}/10: straightforward task`;

  return { complexity, reasoning };
}

export type { WorkflowType, RouterResult };
