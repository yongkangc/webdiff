import {
  DiffAlgorithm,
  flagsToGitDiffOptions,
  GitDiffOptions,
  gitDiffOptionsToFlags,
} from './diff-options';

/** Type of global server_config object */
export interface ServerConfig {
  webdiff: WebdiffConfig;
  'webdiff.colors': ColorsConfig;
  diff: {
    algorithm?: DiffAlgorithm;
  };
}

export interface WebdiffConfig {
  unified: number;
  extraDirDiffArgs: string;
  extraFileDiffArgs: string;
  openBrowser: boolean;
  port: number;
  maxDiffWidth: number;
  theme: string;
  maxLinesForSyntax: number;
}

export interface ColorsConfig {
  insert: string;
  delete: string;
  charInsert: string;
  charDelete: string;
}

declare const SERVER_CONFIG: ServerConfig;

export function injectStylesFromConfig() {
  const colors = SERVER_CONFIG['webdiff.colors'];
  document.write(`
  <style>
  .diff .delete, .before.replace {
    background-color: ${colors.delete};
  }
  .diff .insert, .after.replace {
    background-color: ${colors.insert};
  }
  .before .char-replace, .before .char-delete {
    background-color: ${colors.charDelete};
  }
  .after .char-replace, .after .char-insert {
    background-color: ${colors.charInsert};
  }
  </style>
  `);
}

export interface Options extends GitDiffOptions {
  maxDiffWidth: number;
  normalizeJSON: boolean;
}

export function parseOptions(query: URLSearchParams): Partial<Options> {
  const flags = query.getAll('flag');
  const gitDiffOptions = flagsToGitDiffOptions(flags);
  const maxWidthStr = query.get('width');
  const maxDiffWidth = maxWidthStr ? {maxDiffWidth: Number(maxWidthStr)} : undefined;
  const normalizeJsonStr = query.get('normalize_json');
  const normalizeJSON = normalizeJsonStr ? {normalizeJSON: true} : undefined;
  return {...gitDiffOptions, ...maxDiffWidth, ...normalizeJSON};
}

export function encodeOptions(options: Partial<Options>) {
  const {maxDiffWidth, normalizeJSON, ...diffOptions} = options;
  const flags = gitDiffOptionsToFlags(diffOptions);
  const params = new URLSearchParams(flags.map(f => ['flag', f]));
  if (maxDiffWidth !== undefined && maxDiffWidth !== SERVER_CONFIG.webdiff.maxDiffWidth) {
    params.set('width', String(maxDiffWidth));
  }
  if (normalizeJSON) {
    params.set('normalize_json', '1');
  }
  return params;
}

export type UpdateOptionsFn = (
  updater: ((oldOptions: Partial<Options>) => Partial<Options>) | Partial<Options>,
) => void;
