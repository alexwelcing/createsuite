/**
 * CreateSuite - Orchestrated swarm system for OpenCode agents
 * 
 * Main entry point for programmatic usage
 */

export { ConfigManager } from './config';
export { TaskManager } from './taskManager';
export { AgentOrchestrator } from './agentOrchestrator';
export { ConvoyManager } from './convoyManager';
export { GitIntegration } from './gitIntegration';
export { OAuthManager } from './oauthManager';
export { ProviderManager, Provider } from './providerManager';

export * from './types';
