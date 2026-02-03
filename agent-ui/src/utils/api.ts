/**
 * API utility functions for the agent-ui
 */

/**
 * Constructs an API URL with the correct base path.
 * In production, this returns the path as-is.
 * Can be extended to support custom API hosts if needed.
 */
export function apiUrl(path: string): string {
  // For now, return the path directly - requests go to the same host
  return path;
}
