/**
 * CreateSuite - Orchestrated swarm system for OpenCode agents
 * 
 * Main entry point for programmatic usage
 */

export { ConfigManager } from './config';
export { TaskManager } from './taskManager';
export { PlanManager } from './planManager';
export { AgentOrchestrator } from './agentOrchestrator';
export { ConvoyManager } from './convoyManager';
export { GitIntegration } from './gitIntegration';
export { OAuthManager } from './oauthManager';
export { ProviderManager, Provider } from './providerManager';
export { LocalhostOAuth } from './localhostOAuth';
export { Entrypoint } from './entrypoint';
export { SmartRouter, analyzeComplexity } from './smartRouter';
export { RepoManager } from './repoManager';
export { PRManager } from './prManager';

export * from './types';
export type { WorkflowType, RouterResult } from './smartRouter';
