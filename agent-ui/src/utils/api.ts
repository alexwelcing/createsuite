/**
 * Path normalizer for API requests; can be extended for base URLs later.
 * @param path Relative API path.
 */
export const apiUrl = (path: string) => {
  const normalizedPath = (path || '').trim();
  if (!normalizedPath) {
    return '/';
  }
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};
