/**
 * API utility functions for the agent-ui
 */

/**
 * Constructs an API URL with the correct base path.
 * Normalizes paths to ensure they start with '/'.
 * Can be extended to support custom API hosts if needed.
 */
export function apiUrl(path: string): string {
  const normalizedPath = (path || '').trim();
  if (!normalizedPath) {
    return '/';
  }
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}
