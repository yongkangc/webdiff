// Utility functions for constructing API URLs with root path support

declare const ROOT_PATH: string;

/**
 * Construct an API URL with the appropriate base path.
 * @param path The API path (should start with /)
 * @returns The full URL path including the root path if configured
 */
export function apiUrl(path: string): string {
  return ROOT_PATH + path;
}

/**
 * Get the base path for the router.
 */
export function getBasePath(): string {
  return ROOT_PATH;
}