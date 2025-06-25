import {FilePair} from './CodeDiffContainer';
import {DiffRange} from './codediff/codes';
import {apiUrl} from './api-utils';

export interface UnifiedFileData {
  idx: number;
  thick: FilePair;
  content_a: string | null;
  content_b: string | null;
  diff_ops: DiffRange[];
  diff_error?: string;
}

/**
 * Fetches all data needed to render a file diff in a single request.
 * This includes thick diff metadata, file contents for both sides, and diff operations.
 */
export async function getUnifiedFileData(
  idx: number,
  options: string[],
  normalizeJson: boolean
): Promise<UnifiedFileData> {
  const params = new URLSearchParams();
  params.set('normalize_json', String(normalizeJson));
  if (options.length > 0) {
    params.set('options', options.join(','));
  }

  const response = await fetch(apiUrl(`/file/${idx}?${params}`));
  if (!response.ok) {
    throw new Error(`Failed to fetch file data: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Transform the response to match our expected types
  return {
    idx: data.idx,
    thick: data.thick,
    content_a: data.content_a,
    content_b: data.content_b,
    diff_ops: data.diff_ops || [],
    diff_error: data.diff_error
  };
}

// Cache for unified file data
const unifiedCache: Map<string, UnifiedFileData> = new Map();

/**
 * Get unified file data with caching.
 * Cache key includes index, options, and normalizeJson flag.
 */
export async function getCachedUnifiedFileData(
  idx: number,
  options: string[],
  normalizeJson: boolean
): Promise<UnifiedFileData> {
  const cacheKey = `${idx}-${options.join(',')}-${normalizeJson}`;
  
  if (unifiedCache.has(cacheKey)) {
    return unifiedCache.get(cacheKey)!;
  }
  
  const data = await getUnifiedFileData(idx, options, normalizeJson);
  unifiedCache.set(cacheKey, data);
  return data;
}

/**
 * Clear the unified cache (useful when options change globally)
 */
export function clearUnifiedCache() {
  unifiedCache.clear();
}